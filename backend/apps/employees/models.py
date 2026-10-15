import os
import uuid

from django.conf import settings
from django.db import models

from apps.core.validators import code_validator, phone_validator
from apps.organization.models import Department, Position


class EmploymentStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "En poste"
    SUSPENDED = "SUSPENDED", "Suspendu"
    TERMINATED = "TERMINATED", "Sorti"


def employee_photo_path(instance, filename):
    """Random file name: never expose personal data nor allow guessing file URLs."""
    extension = os.path.splitext(filename)[1].lower()
    return f"employees/photos/{uuid.uuid4().hex}{extension}"


class Employee(models.Model):
    """Employee record. Never hard-deleted: departures are recorded with a status."""

    matricule = models.CharField("matricule", max_length=20, unique=True, validators=[code_validator])
    last_name = models.CharField("nom", max_length=150)
    first_name = models.CharField("prénom", max_length=150)
    date_of_birth = models.DateField("date de naissance")

    work_email = models.EmailField("e-mail professionnel", unique=True, null=True, blank=True)
    personal_email = models.EmailField("e-mail personnel", blank=True)
    work_phone = models.CharField("téléphone professionnel", max_length=30, blank=True, validators=[phone_validator])
    personal_phone = models.CharField("téléphone personnel", max_length=30, blank=True, validators=[phone_validator])
    address_line = models.CharField("adresse", max_length=255, blank=True)
    postal_code = models.CharField("code postal", max_length=20, blank=True)
    city = models.CharField("ville", max_length=100, blank=True)

    hire_date = models.DateField("date d'embauche")
    # Current assignment (history lives in EmployeeAssignment). Changed only through services.assign().
    department = models.ForeignKey(
        Department, verbose_name="département", on_delete=models.PROTECT, related_name="employees"
    )
    position = models.ForeignKey(
        Position, verbose_name="poste", on_delete=models.PROTECT, related_name="employees"
    )
    employment_status = models.CharField(
        "statut professionnel",
        max_length=20,
        choices=EmploymentStatus.choices,
        default=EmploymentStatus.ACTIVE,
    )
    departure_date = models.DateField("date de départ", null=True, blank=True)

    photo = models.ImageField("photo", upload_to=employee_photo_path, blank=True)
    # Optional link to a login account; it is what grants an employee access to their own record.
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        verbose_name="compte utilisateur",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="employee",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["last_name", "first_name"]
        verbose_name = "employé"
        verbose_name_plural = "employés"
        indexes = [
            models.Index(fields=["employment_status"]),
            models.Index(fields=["hire_date"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(hire_date__gt=models.F("date_of_birth")),
                name="employee_hired_after_birth",
            ),
            models.CheckConstraint(
                condition=models.Q(departure_date__isnull=True)
                | models.Q(departure_date__gte=models.F("hire_date")),
                name="employee_departure_after_hire",
            ),
            # A departure date exists if and only if the employee has left.
            models.CheckConstraint(
                condition=(
                    models.Q(employment_status="TERMINATED", departure_date__isnull=False)
                    | (~models.Q(employment_status="TERMINATED") & models.Q(departure_date__isnull=True))
                ),
                name="employee_departure_matches_status",
            ),
        ]

    def __str__(self):
        return f"{self.matricule} - {self.last_name} {self.first_name}"

    def save(self, *args, **kwargs):
        self.matricule = self.matricule.upper()
        if self.work_email:
            self.work_email = self.work_email.lower()
        super().save(*args, **kwargs)


class EmployeeAssignment(models.Model):
    """History of department / position assignments. Rows are closed, never overwritten."""

    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name="assignments")
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="+")
    position = models.ForeignKey(Position, on_delete=models.PROTECT, related_name="+")
    start_date = models.DateField("début")
    end_date = models.DateField("fin", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-start_date"]
        verbose_name = "affectation"
        verbose_name_plural = "affectations"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(end_date__isnull=True) | models.Q(end_date__gte=models.F("start_date")),
                name="assignment_end_after_start",
            ),
            models.UniqueConstraint(
                fields=["employee"],
                condition=models.Q(end_date__isnull=True),
                name="one_open_assignment_per_employee",
            ),
        ]

    def __str__(self):
        return f"{self.employee_id}: {self.department_id}/{self.position_id} from {self.start_date}"