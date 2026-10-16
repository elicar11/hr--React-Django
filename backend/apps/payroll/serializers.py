from rest_framework import serializers

from apps.contracts.models import currency_validator
from apps.core.fields import CodeField
from apps.employees.models import Employee

from .models import (
    DEDUCTION_CATEGORIES,
    EmployeePayItem,
    Payment,
    PaymentMethod,
    PayItemCalculation,
    PayItemCategory,
    PayItemType,
    PayrollPeriod,
    PayrollSettings,
    Payslip,
    PayslipHistory,
    PayslipLine,
)

DEMO_WARNING = "DÉMO : paramètres fictifs, non utilisables pour une paie réelle."
SYSTEM_CATEGORY = {
    PayItemCalculation.SYSTEM_BASE_SALARY: PayItemCategory.BASE_SALARY,
    PayItemCalculation.SYSTEM_OVERTIME: PayItemCategory.OVERTIME,
    PayItemCalculation.SYSTEM_UNPAID_LEAVE: PayItemCategory.ABSENCE,
}


class PayrollSettingsSerializer(serializers.ModelSerializer):
    currency = serializers.CharField(max_length=3, required=False, allow_blank=True, validators=[currency_validator])
    demo_warning = serializers.SerializerMethodField()

    class Meta:
        model = PayrollSettings
        fields = [
            "currency", "country", "is_demo", "demo_warning", "monthly_hours",
            "overtime_multiplier", "prorate_partial_periods", "updated_at",
        ]
        read_only_fields = ["updated_at"]

    def get_demo_warning(self, obj) -> str | None:
        return DEMO_WARNING if obj.is_demo else None

    def validate_currency(self, value):
        return value.upper()


class PayItemTypeSerializer(serializers.ModelSerializer):
    code = CodeField()

    class Meta:
        model = PayItemType
        fields = [
            "id", "code", "name", "category", "calculation", "default_amount", "default_rate",
            "applies_to_all", "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_code(self, value):
        queryset = PayItemType.objects.filter(code__iexact=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("Ce code est déjà utilisé.")
        return value

    def validate(self, attrs):
        def current(name, default=None):
            return attrs.get(name, getattr(self.instance, name, default))

        category, calculation = current("category"), current("calculation")
        amount, rate, applies = current("default_amount"), current("default_rate"), current("applies_to_all", False)

        if calculation in SYSTEM_CATEGORY:
            if category != SYSTEM_CATEGORY[calculation]:
                raise serializers.ValidationError(
                    {"category": f"Ce calcul système exige la catégorie {SYSTEM_CATEGORY[calculation]}."}
                )
            if applies or amount is not None or rate is not None:
                raise serializers.ValidationError(
                    "Un élément calculé par le système n'a ni montant, ni taux, ni application automatique."
                )
        else:
            if category in (PayItemCategory.BASE_SALARY, PayItemCategory.OVERTIME):
                raise serializers.ValidationError(
                    {"category": "Les catégories salaire de base et heures supplémentaires sont réservées aux éléments système."}
                )
            if category == PayItemCategory.ABSENCE and calculation != PayItemCalculation.FIXED:
                raise serializers.ValidationError({"calculation": "Une retenue sur absence manuelle est à montant fixe."})
            if calculation == PayItemCalculation.PERCENT_OF_GROSS and category not in DEDUCTION_CATEGORIES:
                raise serializers.ValidationError(
                    {"calculation": "Un pourcentage du brut ne s'applique qu'aux cotisations, impôts et retenues."}
                )
            if calculation == PayItemCalculation.FIXED and rate is not None:
                raise serializers.ValidationError({"default_rate": "Un type à montant fixe n'a pas de taux."})
            if calculation != PayItemCalculation.FIXED and amount is not None:
                raise serializers.ValidationError({"default_amount": "Un type en pourcentage n'a pas de montant."})
            if applies and calculation == PayItemCalculation.FIXED and amount is None:
                raise serializers.ValidationError({"default_amount": "Un type appliqué à tous exige un montant par défaut."})
            if applies and calculation != PayItemCalculation.FIXED and rate is None:
                raise serializers.ValidationError({"default_rate": "Un type appliqué à tous exige un taux par défaut."})

        if self.instance and (
            attrs.get("category", self.instance.category) != self.instance.category
            or attrs.get("calculation", self.instance.calculation) != self.instance.calculation
        ):
            if self.instance.employee_items.exists() or self.instance.payslip_lines.exists():
                raise serializers.ValidationError(
                    "Ce type est déjà utilisé : sa catégorie et son calcul ne peuvent plus changer. Créez-en un nouveau."
                )
        return attrs


class EmployeePayItemSerializer(serializers.ModelSerializer):
    employee_matricule = serializers.CharField(source="employee.matricule", read_only=True)
    item_type_code = serializers.CharField(source="item_type.code", read_only=True)
    item_type_name = serializers.CharField(source="item_type.name", read_only=True)

    class Meta:
        model = EmployeePayItem
        fields = [
            "id", "employee", "employee_matricule", "item_type", "item_type_code", "item_type_name",
            "amount", "rate", "start_date", "end_date", "created_at",
        ]
        read_only_fields = fields


class EmployeePayItemCreateSerializer(serializers.Serializer):
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.all())
    item_type = serializers.PrimaryKeyRelatedField(queryset=PayItemType.objects.all())
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0, required=False, allow_null=True)
    rate = serializers.DecimalField(max_digits=7, decimal_places=4, min_value=0, required=False, allow_null=True)
    start_date = serializers.DateField()
    end_date = serializers.DateField(required=False, allow_null=True)


class EndPayItemSerializer(serializers.Serializer):
    end_date = serializers.DateField()


class PayrollPeriodSerializer(serializers.ModelSerializer):
    code = CodeField()
    payslips_count = serializers.IntegerField(read_only=True)
    total_gross = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    total_deductions = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    total_net = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = PayrollPeriod
        fields = [
            "id", "code", "name", "start_date", "end_date", "status", "closed_at",
            "payslips_count", "total_gross", "total_deductions", "total_net", "created_at",
        ]
        read_only_fields = ["id", "status", "closed_at", "created_at"]

    def validate_code(self, value):
        queryset = PayrollPeriod.objects.filter(code__iexact=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("Ce code est déjà utilisé.")
        return value

    def validate(self, attrs):
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and end < start:
            raise serializers.ValidationError({"end_date": "La fin de période doit suivre son début."})
        return attrs


class PayslipLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayslipLine
        fields = ["id", "code", "label", "category", "base_amount", "rate", "quantity", "amount", "note", "is_manual"]
        read_only_fields = fields


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ["method", "payment_date", "amount"]
        read_only_fields = fields


class PayslipListSerializer(serializers.ModelSerializer):
    employee_matricule = serializers.CharField(source="employee.matricule", read_only=True)
    employee_name = serializers.SerializerMethodField()
    period_code = serializers.CharField(source="period.code", read_only=True)
    demo_warning = serializers.SerializerMethodField()

    class Meta:
        model = Payslip
        fields = [
            "id", "reference", "revision", "employee", "employee_matricule", "employee_name",
            "period", "period_code", "status", "currency", "gross_pay", "total_deductions",
            "net_pay", "is_demo", "demo_warning",
        ]
        read_only_fields = fields

    def get_employee_name(self, obj) -> str:
        return f"{obj.employee.last_name} {obj.employee.first_name}"

    def get_demo_warning(self, obj) -> str | None:
        return DEMO_WARNING if obj.is_demo else None


class PayslipSerializer(PayslipListSerializer):
    """Detail for the employee: totals and lines, no internal data."""

    lines = PayslipLineSerializer(many=True, read_only=True)
    payment = PaymentSerializer(read_only=True)
    department_name = serializers.CharField(source="employee.department.name", read_only=True)
    period_start = serializers.DateField(source="period.start_date", read_only=True)
    period_end = serializers.DateField(source="period.end_date", read_only=True)

    class Meta(PayslipListSerializer.Meta):
        fields = PayslipListSerializer.Meta.fields + [
            "department_name", "period_start", "period_end", "validated_at", "lines", "payment",
        ]
        read_only_fields = fields


class PayslipAdminSerializer(PayslipSerializer):
    """Detail for ADMIN / HR: adds the calculation context and who did what."""

    class Meta(PayslipSerializer.Meta):
        fields = PayslipSerializer.Meta.fields + [
            "calculation_context", "calculated_at", "calculated_by", "validated_by",
            "cancelled_at", "cancelled_by", "cancel_reason",
        ]
        read_only_fields = fields


class ManualLineSerializer(serializers.Serializer):
    item_type = serializers.PrimaryKeyRelatedField(queryset=PayItemType.objects.all())
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)
    note = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")


class CommentSerializer(serializers.Serializer):
    comment = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")


class CancelPayslipSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=500)


class PayPayslipSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=PaymentMethod.choices)
    payment_date = serializers.DateField()
    reference = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")


class PayslipHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = PayslipHistory
        fields = ["id", "created_at", "action", "actor_email", "from_status", "to_status", "comment"]
        read_only_fields = fields