from django.conf import settings
from django.core.validators import MaxValueValidator
from django.db import models

from apps.core.validators import code_validator
from apps.employees.models import Employee


def default_working_days():
    return [0, 1, 2, 3, 4]  # Monday to Friday (Monday = 0)


class WorkSchedule(models.Model):
    """Working hours and the attendance policy parameters attached to them."""

    code = models.CharField("code", max_length=20, unique=True, validators=[code_validator])
    name = models.CharField("nom", max_length=150)
    start_time = models.TimeField("heure de début")
    end_time = models.TimeField("heure de fin")
    break_start = models.TimeField("début de pause", null=True, blank=True)
    break_end = models.TimeField("fin de pause", null=True, blank=True)
    working_days = models.JSONField(
        "jours travaillés", default=default_working_days, help_text="0 = lundi ... 6 = dimanche."
    )
    late_grace_minutes = models.PositiveSmallIntegerField(
        "tolérance de retard (min)", default=0, validators=[MaxValueValidator(240)]
    )
    overtime_threshold_minutes = models.PositiveSmallIntegerField(
        "seuil des heures supplémentaires (min)", default=0, validators=[MaxValueValidator(240)]
    )
    is_default = models.BooleanField("horaire par défaut", default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["code"]
        verbose_name = "horaire de travail"
        verbose_name_plural = "horaires de travail"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(end_time__gt=models.F("start_time")),
                name="schedule_end_after_start",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(break_start__isnull=True, break_end__isnull=True)
                    | models.Q(
                        break_start__isnull=False,
                        break_end__isnull=False,
                        break_start__lt=models.F("break_end"),
                    )
                ),
                name="schedule_break_consistent",
            ),
            models.UniqueConstraint(
                fields=["is_default"],
                condition=models.Q(is_default=True),
                name="single_default_schedule",
            ),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"

    def save(self, *args, **kwargs):
        self.code = self.code.upper()
        super().save(*args, **kwargs)


class ScheduleAssignment(models.Model):
    """Schedule of an employee over a period. History is kept, never overwritten."""

    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name="schedule_assignments")
    schedule = models.ForeignKey(WorkSchedule, on_delete=models.PROTECT, related_name="assignments")
    start_date = models.DateField("début")
    end_date = models.DateField("fin", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-start_date"]
        verbose_name = "affectation d'horaire"
        verbose_name_plural = "affectations d'horaire"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(end_date__isnull=True) | models.Q(end_date__gte=models.F("start_date")),
                name="schedule_assignment_end_after_start",
            ),
            models.UniqueConstraint(
                fields=["employee"],
                condition=models.Q(end_date__isnull=True),
                name="one_open_schedule_assignment_per_employee",
            ),
        ]

    def __str__(self):
        return f"{self.employee_id}: {self.schedule_id} from {self.start_date}"


class Holiday(models.Model):
    """Public holiday entered by HR. Treated as a non-working day."""

    date = models.DateField("date", unique=True)
    name = models.CharField("nom", max_length=150)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["date"]
        verbose_name = "jour férié"
        verbose_name_plural = "jours fériés"

    def __str__(self):
        return f"{self.date} - {self.name}"


class AttendanceStatus(models.TextChoices):
    PRESENT = "PRESENT", "Présent"
    ABSENT_JUSTIFIED = "ABSENT_JUSTIFIED", "Absence justifiée"
    ABSENT_UNJUSTIFIED = "ABSENT_UNJUSTIFIED", "Absence injustifiée"


class AttendanceSource(models.TextChoices):
    CLOCK = "CLOCK", "Pointage"
    MANUAL = "MANUAL", "Saisie / correction RH"
    SYSTEM = "SYSTEM", "Généré par le système"


class AttendanceRecord(models.Model):
    """One working day of one employee. The minute fields are computed by the backend."""

    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name="attendance_records")
    date = models.DateField("date")
    # Schedule used for the computation (snapshot): later schedule edits do not rewrite history.
    schedule = models.ForeignKey(
        WorkSchedule, null=True, blank=True, on_delete=models.PROTECT, related_name="records"
    )
    status = models.CharField("statut", max_length=20, choices=AttendanceStatus.choices)
    source = models.CharField("source", max_length=10, choices=AttendanceSource.choices)
    check_in = models.DateTimeField("entrée", null=True, blank=True)
    check_out = models.DateTimeField("sortie", null=True, blank=True)
    worked_minutes = models.PositiveIntegerField("minutes travaillées", default=0)
    late_minutes = models.PositiveIntegerField("minutes de retard", default=0)
    overtime_minutes = models.PositiveIntegerField("minutes supplémentaires", default=0)
    absence_reason = models.CharField(
        "motif d'absence", max_length=255, blank=True,
        help_text="Ne pas saisir de données médicales.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "employee_id"]
        verbose_name = "enregistrement de présence"
        verbose_name_plural = "enregistrements de présence"
        indexes = [models.Index(fields=["date"])]
        constraints = [
            # Prevents double records for the same employee and day.
            models.UniqueConstraint(fields=["employee", "date"], name="one_attendance_record_per_day"),
            models.CheckConstraint(
                condition=models.Q(check_in__isnull=True)
                | models.Q(check_out__isnull=True)
                | models.Q(check_out__gt=models.F("check_in")),
                name="attendance_checkout_after_checkin",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(status="PRESENT", check_in__isnull=False)
                    | (
                        ~models.Q(status="PRESENT")
                        & models.Q(check_in__isnull=True, check_out__isnull=True)
                    )
                ),
                name="attendance_times_match_status",
            ),
        ]

    def __str__(self):
        return f"{self.employee_id} {self.date} {self.status}"


class CorrectionStatus(models.TextChoices):
    PENDING = "PENDING", "En attente"
    APPROVED = "APPROVED", "Approuvée"
    REJECTED = "REJECTED", "Refusée"
    CANCELLED = "CANCELLED", "Annulée"


class AttendanceCorrection(models.Model):
    """Employee request to fix a day's clock times, validated by ADMIN / HR."""

    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name="attendance_corrections")
    date = models.DateField("date")
    check_in = models.DateTimeField("entrée proposée")
    check_out = models.DateTimeField("sortie proposée", null=True, blank=True)
    reason = models.CharField("motif", max_length=500)
    status = models.CharField(
        "statut", max_length=10, choices=CorrectionStatus.choices, default=CorrectionStatus.PENDING
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    decision_comment = models.CharField("commentaire", max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        verbose_name = "demande de correction"
        verbose_name_plural = "demandes de correction"
        constraints = [
            models.UniqueConstraint(
                fields=["employee", "date"],
                condition=models.Q(status="PENDING"),
                name="one_pending_correction_per_day",
            ),
            models.CheckConstraint(
                condition=models.Q(check_out__isnull=True) | models.Q(check_out__gt=models.F("check_in")),
                name="correction_checkout_after_checkin",
            ),
        ]

    def __str__(self):
        return f"{self.employee_id} {self.date} {self.status}"