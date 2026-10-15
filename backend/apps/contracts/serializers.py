from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from apps.core.fields import CodeField
from apps.core.models import AuditLog
from apps.employees.models import Employee
from apps.organization.models import Position

from .models import Contract, ContractDocument, ContractStatus, ContractType, currency_validator

MAX_DOCUMENT_SIZE = 5 * 1024 * 1024  # 5 MB


def _ensure_reference_free(value, exclude_pk=None):
    queryset = Contract.objects.filter(reference__iexact=value)
    if exclude_pk:
        queryset = queryset.exclude(pk=exclude_pk)
    if queryset.exists():
        raise serializers.ValidationError("Cette référence est déjà utilisée.")
    return value


def _days_remaining(contract):
    """Days left before the end date of a running contract (negative = overdue)."""
    if contract.status == ContractStatus.ACTIVE and contract.end_date:
        return (contract.end_date - timezone.localdate()).days
    return None


class ContractTypeSerializer(serializers.ModelSerializer):
    code = CodeField()

    class Meta:
        model = ContractType
        fields = ["id", "code", "name", "description", "is_fixed_term", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_code(self, value):
        queryset = ContractType.objects.filter(code__iexact=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("Ce code est déjà utilisé.")
        return value


class ContractListSerializer(serializers.ModelSerializer):
    """Light representation for lists: no salary."""

    employee_matricule = serializers.CharField(source="employee.matricule", read_only=True)
    employee_name = serializers.SerializerMethodField()
    contract_type_name = serializers.CharField(source="contract_type.name", read_only=True)
    position_title = serializers.CharField(source="position.title", read_only=True)
    days_remaining = serializers.SerializerMethodField()

    class Meta:
        model = Contract
        fields = [
            "id", "reference", "employee", "employee_matricule", "employee_name",
            "contract_type", "contract_type_name", "position", "position_title",
            "start_date", "end_date", "status", "days_remaining",
        ]
        read_only_fields = fields

    def get_employee_name(self, obj) -> str:
        return f"{obj.employee.last_name} {obj.employee.first_name}"

    def get_days_remaining(self, obj) -> int | None:
        return _days_remaining(obj)


class ContractSerializer(ContractListSerializer):
    """Full contract. Status and signature change only through dedicated actions."""

    reference = CodeField()
    currency = CodeField(max_length=3, min_length=3, validators=[currency_validator])
    renewed_by = serializers.SerializerMethodField()

    class Meta:
        model = Contract
        fields = [
            "id", "reference", "employee", "employee_matricule", "employee_name",
            "contract_type", "contract_type_name", "position", "position_title",
            "start_date", "end_date", "probation_days", "base_salary", "currency",
            "status", "signed_date", "days_remaining", "renews", "renewed_by",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "status", "signed_date", "renews", "created_at", "updated_at"]

    def get_renewed_by(self, obj) -> int | None:
        successor = getattr(obj, "renewed_by", None)  # missing reverse one-to-one -> None
        return successor.pk if successor else None

    def validate_reference(self, value):
        return _ensure_reference_free(value, self.instance.pk if self.instance else None)

    def validate_employee(self, value):
        if self.instance and value != self.instance.employee:
            raise serializers.ValidationError("L'employé d'un contrat ne peut pas être modifié.")
        return value


class RenewSerializer(serializers.Serializer):
    """Terms of the renewal. Omitted fields are copied from the renewed contract."""

    reference = CodeField()
    start_date = serializers.DateField()
    end_date = serializers.DateField(required=False, allow_null=True)
    contract_type = serializers.PrimaryKeyRelatedField(queryset=ContractType.objects.all(), required=False)
    position = serializers.PrimaryKeyRelatedField(queryset=Position.objects.all(), required=False)
    base_salary = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0"), required=False
    )
    currency = CodeField(max_length=3, min_length=3, validators=[currency_validator], required=False)
    probation_days = serializers.IntegerField(min_value=1, required=False, allow_null=True)

    def validate_reference(self, value):
        return _ensure_reference_free(value)


class ActivateSerializer(serializers.Serializer):
    signed_date = serializers.DateField()


class TerminateContractSerializer(serializers.Serializer):
    end_date = serializers.DateField()


class ContractDocumentSerializer(serializers.ModelSerializer):
    size = serializers.SerializerMethodField()

    class Meta:
        model = ContractDocument
        fields = ["id", "title", "size", "created_at"]
        read_only_fields = fields

    def get_size(self, obj) -> int:
        return obj.file.size


class ContractDocumentUploadSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=150)
    file = serializers.FileField()

    def validate_file(self, value):
        if value.size > MAX_DOCUMENT_SIZE:
            raise serializers.ValidationError("Le document ne doit pas dépasser 5 Mo.")
        if not value.name.lower().endswith(".pdf"):
            raise serializers.ValidationError("Seuls les fichiers PDF sont acceptés.")
        header = value.read(5)
        value.seek(0)
        if header != b"%PDF-":
            raise serializers.ValidationError("Le fichier n'est pas un PDF valide.")
        return value


class ContractHistorySerializer(serializers.ModelSerializer):
    """Audit entries about one contract (no IP address)."""

    class Meta:
        model = AuditLog
        fields = ["id", "created_at", "actor_email", "action", "metadata"]
        read_only_fields = fields