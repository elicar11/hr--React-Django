from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from apps.contracts.models import currency_validator
from apps.core.validators import code_validator
from apps.employees.models import Employee


class PayrollSettings(models.Model):
    """Singleton (id = 1). No business value is assumed: everything is empty until configured.

    `is_demo` stays True while parameters are fictitious: such payslips are NOT usable for a real payroll.
    """

    currency = models.CharField("devise", max_length=3, blank=True, validators=[currency_validator])
    country = models.CharField("pays", max_length=100, blank=True)
    is_demo = models.BooleanField("paramètres de démonstration (fictifs)", default=True)
    monthly_hours = models.DecimalField(
        "heures mensuelles de référence", max_digits=6, decimal_places=2, null=True, blank=True,
        validators=[MinValueValidator(Decimal("0.01"))], help_text="Sert au taux horaire des heures supplémentaires.",
    )
    overtime_multiplier = models.DecimalField(
        "majoration des heures supplémentaires", max_digits=5, decimal_places=2, null=True, blank=True,
        validators=[MinValueValidator(Decimal("0"))], help_text="Ex. 1.50 = taux horaire x 1,5.",
    )
    prorate_partial_periods = models.BooleanField("prorata si contrat partiel sur la période", default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "paramètres de paie"
        verbose_name_plural = "paramètres de paie"
        constraints = [models.CheckConstraint(condition=models.Q(id=1), name="payroll_settings_singleton")]

    def __str__(self):
        return "Paramètres de paie"

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class PayItemCategory(models.TextChoices):
    BASE_SALARY = "BASE_SALARY", "Salaire de base"
    OVERTIME = "OVERTIME", "Heures supplémentaires"
    BONUS = "BONUS", "Prime"
    ALLOWANCE = "ALLOWANCE", "Indemnité"
    BENEFIT = "BENEFIT", "Avantage"
    ABSENCE = "ABSENCE", "Retenue sur absence (réduit le brut)"
    CONTRIBUTION = "CONTRIBUTION", "Cotisation sociale"
    TAX = "TAX", "Impôt / prélèvement"
    DEDUCTION = "DEDUCTION", "Autre retenue"


EARNING_CATEGORIES = frozenset({"BASE_SALARY", "OVERTIME", "BONUS", "ALLOWANCE", "BENEFIT"})
ADJUSTMENT_CATEGORIES = frozenset({"ABSENCE"})  # reduce the gross
DEDUCTION_CATEGORIES = frozenset({"CONTRIBUTION", "TAX", "DEDUCTION"})  # reduce the net
CATEGORY_ORDER = {
    "BASE_SALARY": 10, "OVERTIME": 20, "BONUS": 30, "ALLOWANCE": 40, "BENEFIT": 50,
    "ABSENCE": 60, "CONTRIBUTION": 70, "TAX": 80, "DEDUCTION": 90,
}


class PayItemCalculation(models.TextChoices):
    FIXED = "FIXED", "Montant fixe"
    PERCENT_OF_BASE = "PERCENT_OF_BASE", "% du salaire de base"
    PERCENT_OF_GROSS = "PERCENT_OF_GROSS", "% du brut (retenues uniquement)"
    SYSTEM_BASE_SALARY = "SYSTEM_BASE_SALARY", "Calculé : salaire de base"
    SYSTEM_OVERTIME = "SYSTEM_OVERTIME", "Calculé : heures supplémentaires"
    SYSTEM_UNPAID_LEAVE = "SYSTEM_UNPAID_LEAVE", "Calculé : congé sans solde"


SYSTEM_CALCULATIONS = ("SYSTEM_BASE_SALARY", "SYSTEM_OVERTIME", "SYSTEM_UNPAID_LEAVE")


class PayItemType(models.Model):
    """Configurable pay element type (bonus, allowance, contribution, tax, ...)."""

    code = models.CharField("code", max_length=20, unique=True, validators=[code_validator])
    name = models.CharField("nom", max_length=150)
    category = models.CharField("catégorie", max_length=15, choices=PayItemCategory.choices)
    calculation = models.CharField("calcul", max_length=25, choices=PayItemCalculation.choices)
    default_amount = models.DecimalField(
        "montant par défaut", max_digits=12, decimal_places=2, null=True, blank=True,
        validators=[MinValueValidator(Decimal("0"))],
    )
    default_rate = models.DecimalField(
        "taux par défaut (%)", max_digits=7, decimal_places=4, null=True, blank=True,
        validators=[MinValueValidator(Decimal("0"))],
    )
    applies_to_all = models.BooleanField(
        "appliqué à tous les employés", default=False,
        help_text="Utilise le montant / taux par défaut pour chaque bulletin.",
    )
    is_active = models.BooleanField("actif", default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["code"]
        verbose_name = "type d'élément de paie"
        verbose_name_plural = "types d'éléments de paie"
        constraints = [
            # At most one type per engine-computed calculation.
            models.UniqueConstraint(
                fields=["calculation"],
                condition=models.Q(calculation__in=list(SYSTEM_CALCULATIONS)),
                name="one_type_per_system_calculation",
            ),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"

    def save(self, *args, **kwargs):
        self.code = self.code.upper()
        super().save(*args, **kwargs)


class EmployeePayItem(models.Model):
    """Recurring pay element of one employee over a period. Immutable: to change the value, end it and create a new one."""

    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name="pay_items")
    item_type = models.ForeignKey(PayItemType, on_delete=models.PROTECT, related_name="employee_items")
    amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    rate = models.DecimalField("taux (%)", max_digits=7, decimal_places=4, null=True, blank=True)
    start_date = models.DateField("début")
    end_date = models.DateField("fin", null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-start_date", "-id"]
        verbose_name = "élément de rémunération"
        verbose_name_plural = "éléments de rémunération"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(end_date__isnull=True) | models.Q(end_date__gte=models.F("start_date")),
                name="pay_item_end_after_start",
            ),
            # Exactly one of amount / rate.
            models.CheckConstraint(
                condition=(
                    models.Q(amount__isnull=False, rate__isnull=True)
                    | models.Q(amount__isnull=True, rate__isnull=False)
                ),
                name="pay_item_amount_xor_rate",
            ),
        ]

    def __str__(self):
        return f"{self.employee_id} {self.item_type_id} from {self.start_date}"


class PayrollPeriodStatus(models.TextChoices):
    OPEN = "OPEN", "Ouverte"
    CLOSED = "CLOSED", "Clôturée"


class PayrollPeriod(models.Model):
    code = models.CharField("code", max_length=20, unique=True, validators=[code_validator])
    name = models.CharField("nom", max_length=150)
    start_date = models.DateField("début")
    end_date = models.DateField("fin")
    status = models.CharField(
        "statut", max_length=10, choices=PayrollPeriodStatus.choices, default=PayrollPeriodStatus.OPEN
    )
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_date"]
        verbose_name = "période de paie"
        verbose_name_plural = "périodes de paie"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(end_date__gte=models.F("start_date")), name="payroll_period_end_after_start"
            ),
        ]

    def __str__(self):
        return f"{self.code} ({self.start_date} → {self.end_date})"

    def save(self, *args, **kwargs):
        self.code = self.code.upper()
        super().save(*args, **kwargs)


class PayslipStatus(models.TextChoices):
    DRAFT = "DRAFT", "Brouillon"
    CALCULATED = "CALCULATED", "Calculé"
    VALIDATED = "VALIDATED", "Validé"
    PAID = "PAID", "Payé"
    CANCELLED = "CANCELLED", "Annulé"


EDITABLE_STATUSES = (PayslipStatus.DRAFT, PayslipStatus.CALCULATED)


class Payslip(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name="payslips")
    period = models.ForeignKey(PayrollPeriod, on_delete=models.PROTECT, related_name="payslips")
    reference = models.CharField("référence", max_length=60, unique=True)
    # 1 for the first payslip; +1 each time a cancelled payslip is replaced.
    revision = models.PositiveSmallIntegerField("révision", default=1)
    status = models.CharField(
        "statut", max_length=12, choices=PayslipStatus.choices, default=PayslipStatus.DRAFT
    )
    # Snapshots of the settings used at calculation time.
    currency = models.CharField(max_length=3, blank=True)
    is_demo = models.BooleanField(default=True)
    gross_pay = models.DecimalField("brut", max_digits=12, decimal_places=2, default=0)
    total_deductions = models.DecimalField("total des retenues", max_digits=12, decimal_places=2, default=0)
    net_pay = models.DecimalField("net à payer", max_digits=12, decimal_places=2, default=0)
    calculation_context = models.JSONField(default=dict, blank=True)

    calculated_at = models.DateTimeField(null=True, blank=True)
    calculated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    validated_at = models.DateTimeField(null=True, blank=True)
    validated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    cancel_reason = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-period__start_date", "employee__last_name", "-revision"]
        verbose_name = "bulletin de paie"
        verbose_name_plural = "bulletins de paie"
        indexes = [models.Index(fields=["status"])]
        constraints = [
            # One active payslip per employee and period (cancelled ones are history).
            models.UniqueConstraint(
                fields=["employee", "period"],
                condition=~models.Q(status="CANCELLED"),
                name="one_active_payslip_per_employee_period",
            ),
            models.CheckConstraint(
                condition=models.Q(net_pay=models.F("gross_pay") - models.F("total_deductions")),
                name="payslip_net_equals_gross_minus_deductions",
            ),
            models.CheckConstraint(condition=models.Q(net_pay__gte=0), name="payslip_net_not_negative"),
            models.CheckConstraint(
                condition=models.Q(status__in=["DRAFT", "CALCULATED", "CANCELLED"])
                | models.Q(validated_at__isnull=False),
                name="payslip_validated_has_date",
            ),
        ]

    def __str__(self):
        return self.reference


class PayslipLine(models.Model):
    """Line of a payslip. Everything is copied from the item type at calculation time (snapshot)."""

    payslip = models.ForeignKey(Payslip, on_delete=models.PROTECT, related_name="lines")
    item_type = models.ForeignKey(PayItemType, on_delete=models.PROTECT, related_name="payslip_lines")
    code = models.CharField(max_length=20)
    label = models.CharField(max_length=150)
    category = models.CharField(max_length=15, choices=PayItemCategory.choices)
    base_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    rate = models.DecimalField(max_digits=7, decimal_places=4, null=True, blank=True)
    quantity = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    note = models.CharField(max_length=200, blank=True)
    is_manual = models.BooleanField(default=False)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "ligne de bulletin"
        verbose_name_plural = "lignes de bulletin"
        constraints = [models.CheckConstraint(condition=models.Q(amount__gte=0), name="payslip_line_amount_not_negative")]

    def save(self, *args, **kwargs):
        self._ensure_editable()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        self._ensure_editable()
        return super().delete(*args, **kwargs)

    def _ensure_editable(self):
        # Model-level guard: lines of a validated, paid or cancelled payslip are frozen.
        if self.payslip.status not in EDITABLE_STATUSES:
            raise ValueError("Les lignes d'un bulletin validé, payé ou annulé sont figées.")


class PaymentMethod(models.TextChoices):
    BANK_TRANSFER = "BANK_TRANSFER", "Virement bancaire"
    MOBILE_MONEY = "MOBILE_MONEY", "Mobile money"
    CASH = "CASH", "Espèces"
    OTHER = "OTHER", "Autre"


class Payment(models.Model):
    """Payment of a payslip. No bank details are stored."""

    payslip = models.OneToOneField(Payslip, on_delete=models.PROTECT, related_name="payment")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(max_length=15, choices=PaymentMethod.choices)
    payment_date = models.DateField("date de paiement")
    reference = models.CharField(
        "référence", max_length=100, blank=True, help_text="Référence de l'opération. Ne pas saisir de numéro de compte."
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "paiement"
        verbose_name_plural = "paiements"


class PayslipHistoryAction(models.TextChoices):
    CREATED = "CREATED", "Création"
    CALCULATED = "CALCULATED", "Calcul"
    LINE_ADDED = "LINE_ADDED", "Ligne ajoutée"
    LINE_REMOVED = "LINE_REMOVED", "Ligne retirée"
    VALIDATED = "VALIDATED", "Validation"
    PAID = "PAID", "Paiement"
    CANCELLED = "CANCELLED", "Annulation"


class PayslipHistory(models.Model):
    """Validation history of a payslip. Append-only, no amounts."""

    payslip = models.ForeignKey(Payslip, on_delete=models.PROTECT, related_name="history")
    action = models.CharField(max_length=15, choices=PayslipHistoryAction.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    actor_email = models.CharField(max_length=254, blank=True)  # snapshot
    from_status = models.CharField(max_length=12, blank=True)
    to_status = models.CharField(max_length=12, blank=True)
    comment = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]
        verbose_name = "historique de bulletin"
        verbose_name_plural = "historique des bulletins"