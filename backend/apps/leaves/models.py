import os
import uuid

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from apps.core.validators import code_validator
from apps.employees.models import Employee


class DayCountMode(models.TextChoices):
    WORKING_DAYS = "WORKING_DAYS", "Jours ouvrés"
    CALENDAR_DAYS = "CALENDAR_DAYS", "Jours calendaires"


class LeaveType(models.Model):
    """Configurable leave type (annual, sick, exceptional, unpaid, ...)."""

    code = models.CharField("code", max_length=20, unique=True, validators=[code_validator])
    name = models.CharField("nom", max_length=150)
    description = models.TextField("description", blank=True)
    day_count_mode = models.CharField(
        "mode de décompte", max_length=20, choices=DayCountMode.choices, default=DayCountMode.WORKING_DAYS
    )
    uses_balance = models.BooleanField(
        "décompté d'un solde", default=True, help_text="Sinon, le type n'est pas limité par un solde."
    )
    annual_allowance = models.DecimalField(
        "allocation annuelle (jours)",
        max_digits=6, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)],
        help_text="Utilisée par l'initialisation des soldes d'une année.",
    )
    requires_document = models.BooleanField("justificatif obligatoire", default=False)
    is_paid = models.BooleanField("congé payé", default=True, help_text="Information pour la paie.")
    is_active = models.BooleanField("actif", default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["code"]
        verbose_name = "type de congé"
        verbose_name_plural = "types de congé"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(annual_allowance__isnull=True) | models.Q(uses_balance=True),
                name="leave_type_allowance_needs_balance",
            ),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"

    def save(self, *args, **kwargs):
        self.code = self.code.upper()
        super().save(*args, **kwargs)


class LeaveBalance(models.Model):
    """Days granted and used by an employee for one leave type over one calendar year."""

    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name="leave_balances")
    leave_type = models.ForeignKey(LeaveType, on_delete=models.PROTECT, related_name="balances")
    year = models.PositiveSmallIntegerField("année")
    allocated = models.DecimalField(
        "jours alloués", max_digits=6, decimal_places=2, default=0, validators=[MinValueValidator(0)]
    )
    used = models.DecimalField("jours utilisés", max_digits=6, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-year", "employee_id", "leave_type_id"]
        verbose_name = "solde de congé"
        verbose_name_plural = "soldes de congé"
        constraints = [
            models.UniqueConstraint(
                fields=["employee", "leave_type", "year"], name="one_balance_per_employee_type_year"
            ),
            models.CheckConstraint(condition=models.Q(used__gte=0), name="leave_balance_used_not_negative"),
            models.CheckConstraint(
                condition=models.Q(used__lte=models.F("allocated")),
                name="leave_balance_used_within_allocation",
            ),
        ]

    def __str__(self):
        return f"{self.employee_id} {self.leave_type_id} {self.year}"

    @property
    def remaining(self):
        return self.allocated - self.used


class LeaveStatus(models.TextChoices):
    PENDING = "PENDING", "En attente"
    APPROVED = "APPROVED", "Approuvée"
    REJECTED = "REJECTED", "Refusée"
    CANCELLED = "CANCELLED", "Annulée"


class LeaveRequest(models.Model):
    """Leave request. The day count is computed by the backend and frozen at creation."""

    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name="leave_requests")
    leave_type = models.ForeignKey(LeaveType, on_delete=models.PROTECT, related_name="requests")
    start_date = models.DateField("début")
    end_date = models.DateField("fin")
    days = models.DecimalField("nombre de jours", max_digits=5, decimal_places=2)
    # Days per calendar year, e.g. {"2026": "2", "2027": "3"}: what is deducted from each balance.
    days_by_year = models.JSONField(default=dict)
    reason = models.CharField(
        "motif", max_length=500, blank=True, help_text="Ne pas saisir de données médicales."
    )
    status = models.CharField(
        "statut", max_length=10, choices=LeaveStatus.choices, default=LeaveStatus.PENDING
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
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_date", "-id"]
        verbose_name = "demande de congé"
        verbose_name_plural = "demandes de congé"
        indexes = [
            models.Index(fields=["employee", "start_date", "end_date"]),
            models.Index(fields=["status"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(end_date__gte=models.F("start_date")), name="leave_end_after_start"
            ),
            models.CheckConstraint(condition=models.Q(days__gt=0), name="leave_days_positive"),
        ]

    def __str__(self):
        return f"{self.employee_id} {self.start_date}→{self.end_date} {self.status}"


class LeaveHistoryAction(models.TextChoices):
    CREATED = "CREATED", "Création"
    UPDATED = "UPDATED", "Modification"
    APPROVED = "APPROVED", "Approbation"
    REJECTED = "REJECTED", "Refus"
    CANCELLED = "CANCELLED", "Annulation"


class LeaveRequestHistory(models.Model):
    """Who did what on a leave request, and when. Append-only."""

    request = models.ForeignKey(LeaveRequest, on_delete=models.PROTECT, related_name="history")
    action = models.CharField(max_length=10, choices=LeaveHistoryAction.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    actor_email = models.CharField(max_length=254, blank=True)  # snapshot
    from_status = models.CharField(max_length=10, blank=True)
    to_status = models.CharField(max_length=10, blank=True)
    comment = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]
        verbose_name = "historique de demande de congé"
        verbose_name_plural = "historique des demandes de congé"


def leave_document_path(instance, filename):
    """Random file name (extension already validated): no personal data, no guessable URL."""
    extension = os.path.splitext(filename)[1].lower()
    return f"leaves/documents/{uuid.uuid4().hex}{extension}"


class LeaveDocument(models.Model):
    """Supporting document (PDF / JPEG / PNG) of a leave request."""

    request = models.ForeignKey(LeaveRequest, on_delete=models.CASCADE, related_name="documents")
    title = models.CharField("titre", max_length=150)
    file = models.FileField("fichier", upload_to=leave_document_path)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        verbose_name = "justificatif de congé"
        verbose_name_plural = "justificatifs de congé"