import uuid

from django.conf import settings
from django.core.validators import MinValueValidator, RegexValidator
from django.db import models

from apps.core.validators import code_validator
from apps.employees.models import Employee
from apps.organization.models import Position

currency_validator = RegexValidator(
    regex=r"^[A-Z]{3}$",
    message="Code devise ISO à 3 lettres majuscules (ex. EUR).",
)


class ContractStatus(models.TextChoices):
    DRAFT = "DRAFT", "Brouillon"
    ACTIVE = "ACTIVE", "En cours"
    ENDED = "ENDED", "Terminé"
    TERMINATED = "TERMINATED", "Rompu"


class ContractType(models.Model):
    """Configurable contract type (e.g. permanent, fixed-term)."""

    code = models.CharField("code", max_length=20, unique=True, validators=[code_validator])
    name = models.CharField("nom", max_length=150)
    description = models.TextField("description", blank=True)
    is_fixed_term = models.BooleanField(
        "durée déterminée", default=False, help_text="Si coché, la date de fin est obligatoire."
    )
    is_active = models.BooleanField("actif", default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["code"]
        verbose_name = "type de contrat"
        verbose_name_plural = "types de contrat"

    def __str__(self):
        return f"{self.code} - {self.name}"

    def save(self, *args, **kwargs):
        self.code = self.code.upper()
        super().save(*args, **kwargs)


class Contract(models.Model):
    """Employment contract. Terms are frozen once activated: changes go through a renewal."""

    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name="contracts")
    contract_type = models.ForeignKey(ContractType, on_delete=models.PROTECT, related_name="contracts")
    reference = models.CharField("référence", max_length=20, unique=True, validators=[code_validator])
    start_date = models.DateField("date de début")
    end_date = models.DateField("date de fin", null=True, blank=True)
    position = models.ForeignKey(Position, on_delete=models.PROTECT, related_name="+")
    base_salary = models.DecimalField(
        "rémunération de base",
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        help_text="Montant contractuel par période de paie.",
    )
    currency = models.CharField("devise", max_length=3, validators=[currency_validator])
    probation_days = models.PositiveSmallIntegerField(
        "période d'essai (jours)", null=True, blank=True, validators=[MinValueValidator(1)]
    )
    status = models.CharField(
        "statut", max_length=20, choices=ContractStatus.choices, default=ContractStatus.DRAFT
    )
    signed_date = models.DateField("date de signature", null=True, blank=True)
    # Predecessor of this contract (renewal chain). Each contract is renewed at most once.
    renews = models.OneToOneField(
        "self", null=True, blank=True, on_delete=models.PROTECT, related_name="renewed_by"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_date", "-id"]
        verbose_name = "contrat"
        verbose_name_plural = "contrats"
        indexes = [models.Index(fields=["status", "end_date"])]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(end_date__isnull=True)
                | models.Q(end_date__gte=models.F("start_date")),
                name="contract_end_after_start",
            ),
            models.CheckConstraint(
                condition=models.Q(status="DRAFT") | models.Q(signed_date__isnull=False),
                name="contract_signed_unless_draft",
            ),
            models.CheckConstraint(
                condition=models.Q(status__in=["DRAFT", "ACTIVE"]) | models.Q(end_date__isnull=False),
                name="contract_closed_has_end_date",
            ),
            models.CheckConstraint(
                condition=models.Q(base_salary__gte=0),
                name="contract_salary_not_negative",
            ),
        ]

    def __str__(self):
        return f"{self.reference} ({self.employee_id})"

    def save(self, *args, **kwargs):
        self.reference = self.reference.upper()
        self.currency = self.currency.upper()
        super().save(*args, **kwargs)


def contract_document_path(instance, filename):
    """Random file name: never expose personal data nor allow guessing file URLs."""
    return f"contracts/documents/{uuid.uuid4().hex}.pdf"


class ContractDocument(models.Model):
    """PDF attached to a contract (e.g. the signed copy)."""

    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name="documents")
    title = models.CharField("titre", max_length=150)
    file = models.FileField("fichier", upload_to=contract_document_path)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        verbose_name = "document de contrat"
        verbose_name_plural = "documents de contrat"

    def __str__(self):
        return f"{self.title} ({self.contract_id})"