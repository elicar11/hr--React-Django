from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import User
from apps.core.fields import CodeField
from apps.core.models import AuditLog
from apps.organization.models import Department, Position

from .models import Employee, EmployeeAssignment

MAX_PHOTO_SIZE = 2 * 1024 * 1024  # 2 MB
MAX_PHOTO_SIDE = 4000  # pixels
# Allowed image format -> allowed file extensions (the two must agree).
PHOTO_FORMATS = {
    "JPEG": {".jpg", ".jpeg"},
    "PNG": {".png"},
    "WEBP": {".webp"},
}


class EmployeeListSerializer(serializers.ModelSerializer):
    """Light representation for lists: no birth date, personal contacts or address."""

    department_name = serializers.CharField(source="department.name", read_only=True)
    position_title = serializers.CharField(source="position.title", read_only=True)
    has_photo = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            "id", "matricule", "first_name", "last_name", "work_email",
            "department", "department_name", "position", "position_title",
            "employment_status", "hire_date", "has_photo",
        ]
        read_only_fields = fields

    def get_has_photo(self, obj) -> bool:
        return bool(obj.photo)


class EmployeeSerializer(serializers.ModelSerializer):
    """Full record. Assignment, status and departure are changed only through dedicated actions."""

    matricule = CodeField()
    work_email = serializers.EmailField(required=False, allow_null=True, allow_blank=True)
    user = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), required=False, allow_null=True
    )
    department = serializers.PrimaryKeyRelatedField(read_only=True)
    position = serializers.PrimaryKeyRelatedField(read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    position_title = serializers.CharField(source="position.title", read_only=True)
    has_photo = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            "id", "matricule", "last_name", "first_name", "date_of_birth",
            "work_email", "personal_email", "work_phone", "personal_phone",
            "address_line", "postal_code", "city",
            "hire_date", "department", "department_name", "position", "position_title",
            "employment_status", "departure_date", "has_photo", "user",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "employment_status", "departure_date", "created_at", "updated_at"]

    def get_has_photo(self, obj) -> bool:
        return bool(obj.photo)

    def validate_matricule(self, value):
        queryset = Employee.objects.filter(matricule__iexact=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("Ce matricule est déjà utilisé.")
        return value

    def validate_work_email(self, value):
        value = (value or "").strip().lower() or None  # empty string stored as NULL
        if value:
            queryset = Employee.objects.filter(work_email__iexact=value)
            if self.instance:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError("Cette adresse e-mail professionnelle est déjà utilisée.")
        return value

    def validate_user(self, value):
        if value is not None:
            queryset = Employee.objects.filter(user=value)
            if self.instance:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError("Ce compte utilisateur est déjà associé à un autre employé.")
        return value

    def validate_date_of_birth(self, value):
        if value >= timezone.localdate():
            raise serializers.ValidationError("La date de naissance doit être dans le passé.")
        return value

    def validate(self, attrs):
        birth = attrs.get("date_of_birth", getattr(self.instance, "date_of_birth", None))
        hired = attrs.get("hire_date", getattr(self.instance, "hire_date", None))
        if birth and hired and hired <= birth:
            raise serializers.ValidationError(
                {"hire_date": "La date d'embauche doit être postérieure à la date de naissance."}
            )
        return attrs


class EmployeeCreateSerializer(EmployeeSerializer):
    """Same as EmployeeSerializer, with the initial assignment writable."""

    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all())
    position = serializers.PrimaryKeyRelatedField(queryset=Position.objects.all())


class AssignmentSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)
    position_title = serializers.CharField(source="position.title", read_only=True)

    class Meta:
        model = EmployeeAssignment
        fields = [
            "id", "department", "department_name", "position", "position_title",
            "start_date", "end_date",
        ]
        read_only_fields = fields


class AssignSerializer(serializers.Serializer):
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all())
    position = serializers.PrimaryKeyRelatedField(queryset=Position.objects.all())
    start_date = serializers.DateField()


class TerminateSerializer(serializers.Serializer):
    departure_date = serializers.DateField()


class PhotoUploadSerializer(serializers.Serializer):
    photo = serializers.ImageField()

    def validate_photo(self, value):
        if value.size > MAX_PHOTO_SIZE:
            raise serializers.ValidationError("La photo ne doit pas dépasser 2 Mo.")
        image = value.image  # opened and verified by Pillow during field validation
        extensions = PHOTO_FORMATS.get(image.format)
        if extensions is None:
            raise serializers.ValidationError("Formats acceptés : JPEG, PNG ou WebP.")
        extension = "." + value.name.rsplit(".", 1)[-1].lower() if "." in value.name else ""
        if extension not in extensions:
            raise serializers.ValidationError("L'extension du fichier ne correspond pas à son contenu.")
        if max(image.size) > MAX_PHOTO_SIDE:
            raise serializers.ValidationError(f"Dimensions maximales : {MAX_PHOTO_SIDE} x {MAX_PHOTO_SIDE} pixels.")
        return value


class EmployeeHistorySerializer(serializers.ModelSerializer):
    """Audit entries about one employee (no IP address)."""

    class Meta:
        model = AuditLog
        fields = ["id", "created_at", "actor_email", "action", "metadata"]
        read_only_fields = fields
        
class EmployeeImportSerializer(serializers.Serializer):
    file = serializers.FileField()
    dry_run = serializers.BooleanField(
        required=False, default=False, help_text="true : valide le fichier sans rien enregistrer."
    )