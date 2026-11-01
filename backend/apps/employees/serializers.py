from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import User
from apps.core.fields import CodeField
from apps.core.models import AuditLog
from apps.organization.models import Department, Position

from .models import Employee, EmployeeAssignment, Gender
from .validators import cin_format_error, cin_sex, normalize_cin

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
            "id", "matricule", "first_name", "last_name",
            "department", "department_name", "position", "position_title",
            "employment_status", "hire_date", "has_photo",
        ]
        read_only_fields = fields

    def get_has_photo(self, obj) -> bool:
        return bool(obj.photo)


GENDER_LABELS = {"M": "Homme", "F": "Femme"}
CIN_WHO = {"M": "un homme (011)", "F": "une femme (012)"}


class EmployeeSerializer(serializers.ModelSerializer):
    """Full record. Assignment, status and departure are changed only through dedicated actions."""

    matricule = CodeField()
    gender = serializers.ChoiceField(choices=Gender.choices, required=False)
    # Longer than 12 on purpose: separators typed by the user ("101 011 123456") are removed first.
    cin_number = serializers.CharField(required=False, allow_null=True, allow_blank=True, max_length=30)
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
            "id", "matricule", "last_name", "first_name", "gender", "date_of_birth",
            "personal_email", "personal_phone",
            "cin_number", "cin_issue_date", "cin_issue_place",
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

    def validate_cin_number(self, value):
        value = normalize_cin(value)  # '' -> None
        if value is None:
            return None
        message = cin_format_error(value)
        if message:
            raise serializers.ValidationError(message)
        queryset = Employee.objects.filter(cin_number=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("Ce numéro CIN est déjà utilisé par un autre employé.")
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
        def current(name, default=None):
            """Submitted value, else the one already stored (partial update)."""
            return attrs[name] if name in attrs else getattr(self.instance, name, default)

        errors = {}
        birth = current("date_of_birth")
        hired = current("hire_date")
        if birth and hired and hired <= birth:
            errors["hire_date"] = "La date d'embauche doit être postérieure à la date de naissance."

        gender = current("gender", "")
        cin = current("cin_number")
        issue_date = current("cin_issue_date")
        issue_place = (current("cin_issue_place", "") or "").strip()

        if cin:
            marker_sex = cin_sex(cin)
            if gender and marker_sex and marker_sex != gender:
                errors["cin_number"] = (
                    f"Ce numéro CIN correspond à {CIN_WHO[marker_sex]} "
                    f"alors que le sexe indiqué est {GENDER_LABELS[gender]}."
                )
            if issue_date is None:
                errors["cin_issue_date"] = "La date de délivrance est obligatoire avec un numéro CIN."
            if not issue_place:
                errors["cin_issue_place"] = "Le lieu de délivrance est obligatoire avec un numéro CIN."
        elif issue_date or issue_place:
            errors["cin_number"] = "Saisissez le numéro CIN, ou videz la date et le lieu de délivrance."

        if issue_date and "cin_issue_date" not in errors:
            if issue_date > timezone.localdate():
                errors["cin_issue_date"] = "La date de délivrance ne peut pas être dans le futur."
            elif birth and issue_date <= birth:
                errors["cin_issue_date"] = "La date de délivrance doit être postérieure à la date de naissance."

        if errors:
            raise serializers.ValidationError(errors)
        return attrs

class EmployeeCreateSerializer(EmployeeSerializer):
    """Same as EmployeeSerializer, with the initial assignment writable and the gender required."""

    gender = serializers.ChoiceField(
        choices=Gender.choices, error_messages={"required": "Le sexe est obligatoire."}
    )
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