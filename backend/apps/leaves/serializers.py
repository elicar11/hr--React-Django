from datetime import timedelta

from django.db.models import Q  # noqa: F401  (kept for future filters)
from rest_framework import serializers

from apps.core.fields import CodeField
from apps.employees.models import Employee

from .models import (
    LeaveBalance,
    LeaveDocument,
    LeaveRequest,
    LeaveRequestHistory,
    LeaveType,
)

MAX_DOCUMENT_SIZE = 5 * 1024 * 1024  # 5 MB
# Magic bytes -> allowed extensions (content and extension must agree).
DOCUMENT_SIGNATURES = (
    (b"%PDF-", {".pdf"}),
    (b"\x89PNG\r\n\x1a\n", {".png"}),
    (b"\xff\xd8\xff", {".jpg", ".jpeg"}),
)


class LeaveTypeSerializer(serializers.ModelSerializer):
    code = CodeField()

    class Meta:
        model = LeaveType
        fields = [
            "id", "code", "name", "description", "day_count_mode", "uses_balance",
            "annual_allowance", "requires_document", "is_paid", "is_active",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_code(self, value):
        queryset = LeaveType.objects.filter(code__iexact=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("Ce code est déjà utilisé.")
        return value

    def validate(self, attrs):
        uses_balance = attrs.get("uses_balance", getattr(self.instance, "uses_balance", True))
        allowance = attrs.get("annual_allowance", getattr(self.instance, "annual_allowance", None))
        if allowance is not None and not uses_balance:
            raise serializers.ValidationError(
                {"annual_allowance": "Une allocation annuelle n'a de sens que pour un type décompté d'un solde."}
            )
        return attrs


class LeaveBalanceSerializer(serializers.ModelSerializer):
    employee_matricule = serializers.CharField(source="employee.matricule", read_only=True)
    employee_name = serializers.SerializerMethodField()
    leave_type_name = serializers.CharField(source="leave_type.name", read_only=True)
    remaining = serializers.DecimalField(max_digits=6, decimal_places=2, read_only=True)

    class Meta:
        model = LeaveBalance
        fields = [
            "id", "employee", "employee_matricule", "employee_name", "leave_type", "leave_type_name",
            "year", "allocated", "used", "remaining", "updated_at",
        ]
        read_only_fields = fields

    def get_employee_name(self, obj) -> str:
        return f"{obj.employee.last_name} {obj.employee.first_name}"


class LeaveBalanceCreateSerializer(serializers.Serializer):
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.all())
    leave_type = serializers.PrimaryKeyRelatedField(queryset=LeaveType.objects.all())
    year = serializers.IntegerField(min_value=2000, max_value=2100)
    allocated = serializers.DecimalField(max_digits=6, decimal_places=2, min_value=0)


class LeaveBalanceUpdateSerializer(serializers.Serializer):
    allocated = serializers.DecimalField(max_digits=6, decimal_places=2, min_value=0)


class InitializeBalancesSerializer(serializers.Serializer):
    year = serializers.IntegerField(min_value=2000, max_value=2100)


class LeaveRequestSerializer(serializers.ModelSerializer):
    employee_matricule = serializers.CharField(source="employee.matricule", read_only=True)
    employee_name = serializers.SerializerMethodField()
    department_name = serializers.CharField(source="employee.department.name", read_only=True)
    leave_type_name = serializers.CharField(source="leave_type.name", read_only=True)
    documents_count = serializers.SerializerMethodField()

    class Meta:
        model = LeaveRequest
        fields = [
            "id", "employee", "employee_matricule", "employee_name", "department_name",
            "leave_type", "leave_type_name", "start_date", "end_date", "days", "days_by_year",
            "reason", "status", "requested_by", "decided_by", "decided_at", "decision_comment",
            "documents_count", "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_employee_name(self, obj) -> str:
        return f"{obj.employee.last_name} {obj.employee.first_name}"

    def get_documents_count(self, obj) -> int:
        value = getattr(obj, "documents_count", None)  # annotated by the viewset
        return value if value is not None else obj.documents.count()


class LeaveRequestCreateSerializer(serializers.Serializer):
    """`employee` is optional: employees request for themselves; ADMIN / HR may request on behalf of someone."""

    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.all(), required=False)
    leave_type = serializers.PrimaryKeyRelatedField(queryset=LeaveType.objects.all())
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    reason = serializers.CharField(max_length=500, required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs["end_date"] < attrs["start_date"]:
            raise serializers.ValidationError(
                {"end_date": "La date de fin doit être postérieure ou égale à la date de début."}
            )
        return attrs


class LeaveRequestUpdateSerializer(serializers.Serializer):
    leave_type = serializers.PrimaryKeyRelatedField(queryset=LeaveType.objects.all(), required=False)
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)
    reason = serializers.CharField(max_length=500, required=False, allow_blank=True)


class DecisionSerializer(serializers.Serializer):
    comment = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")


class RejectSerializer(serializers.Serializer):
    comment = serializers.CharField(max_length=500)


class LeaveHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = LeaveRequestHistory
        fields = ["id", "created_at", "action", "actor_email", "from_status", "to_status", "comment"]
        read_only_fields = fields


class CalendarQuerySerializer(serializers.Serializer):
    date_from = serializers.DateField()
    date_to = serializers.DateField()

    def validate(self, attrs):
        if attrs["date_to"] < attrs["date_from"]:
            raise serializers.ValidationError({"date_to": "La fin doit suivre le début."})
        if (attrs["date_to"] - attrs["date_from"]) > timedelta(days=366):
            raise serializers.ValidationError("La période ne peut pas dépasser 366 jours.")
        return attrs


class LeaveDocumentSerializer(serializers.ModelSerializer):
    size = serializers.SerializerMethodField()

    class Meta:
        model = LeaveDocument
        fields = ["id", "title", "size", "created_at"]
        read_only_fields = fields

    def get_size(self, obj) -> int:
        return obj.file.size


class LeaveDocumentUploadSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=150)
    file = serializers.FileField()

    def validate_file(self, value):
        if value.size > MAX_DOCUMENT_SIZE:
            raise serializers.ValidationError("Le justificatif ne doit pas dépasser 5 Mo.")
        header = value.read(8)
        value.seek(0)
        extension = "." + value.name.rsplit(".", 1)[-1].lower() if "." in value.name else ""
        for signature, extensions in DOCUMENT_SIGNATURES:
            if header.startswith(signature):
                if extension not in extensions:
                    raise serializers.ValidationError("L'extension du fichier ne correspond pas à son contenu.")
                return value
        raise serializers.ValidationError("Formats acceptés : PDF, JPEG ou PNG.")