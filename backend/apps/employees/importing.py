import csv
import io
from dataclasses import dataclass, field

from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.core import audit
from apps.core.models import AuditAction
from apps.organization.models import Department, Position

from . import services
from .serializers import EmployeeCreateSerializer

MAX_FILE_SIZE = 1024 * 1024  # 1 MB
MAX_ROWS = 1000
MAX_REPORTED_ERRORS = 100

REQUIRED_COLUMNS = (
    "matricule", "last_name", "first_name", "date_of_birth", "hire_date", "department_code", "position_code",
)
OPTIONAL_COLUMNS = (
    "work_email", "personal_email", "work_phone", "personal_phone", "address_line", "postal_code", "city",
)
ALLOWED_COLUMNS = REQUIRED_COLUMNS + OPTIONAL_COLUMNS
# Present in exports, read-only: accepted in an import file but ignored (so an export can be re-imported).
IGNORED_COLUMNS = ("employment_status", "departure_date")
# Column order of the export and of the template.
EXPORT_COLUMNS = (
    "matricule", "last_name", "first_name", "date_of_birth", "work_email", "personal_email",
    "work_phone", "personal_phone", "address_line", "postal_code", "city",
    "hire_date", "department_code", "position_code", "employment_status", "departure_date",
)
COLUMN_OF_FIELD = {"department": "department_code", "position": "position_code"}


@dataclass
class ImportResult:
    rows: list = field(default_factory=list)  # (line, validated data) of valid rows
    errors: list = field(default_factory=list)  # first MAX_REPORTED_ERRORS invalid rows
    error_count: int = 0


def _clean(value):
    value = (value or "").strip()
    # An exported cell may carry a protective apostrophe (CSV injection guard): remove it.
    if len(value) > 1 and value[0] == "'" and value[1] in "=+-@":
        value = value[1:]
    return value


def _texts(messages):
    if isinstance(messages, dict):
        return [text for value in messages.values() for text in _texts(value)]
    if isinstance(messages, (list, tuple)):
        return [text for value in messages for text in _texts(value)]
    return [str(messages)]


def read_rows(uploaded_file):
    """Parse the CSV into [(line number, {column: value})]. Raises on any structural problem."""
    if uploaded_file.size > MAX_FILE_SIZE:
        raise ValidationError({"file": "Le fichier ne doit pas dépasser 1 Mo."})
    if not uploaded_file.name.lower().endswith(".csv"):
        raise ValidationError({"file": "Seuls les fichiers .csv sont acceptés."})
    raw = uploaded_file.read()
    if b"\x00" in raw:
        raise ValidationError({"file": "Le fichier n'est pas un CSV texte."})
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise ValidationError({"file": "Encodage attendu : UTF-8."})

    first_line = text.split("\n", 1)[0]
    delimiter = ";" if first_line.count(";") >= first_line.count(",") else ","
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    try:
        header = [name.strip().lower() for name in next(reader)]
    except StopIteration:
        raise ValidationError({"file": "Le fichier est vide."})

    unknown = [name for name in header if name not in ALLOWED_COLUMNS and name not in IGNORED_COLUMNS]
    duplicated = sorted({name for name in header if header.count(name) > 1})
    missing = [name for name in REQUIRED_COLUMNS if name not in header]
    problems = []
    if missing:
        problems.append(f"Colonnes obligatoires manquantes : {', '.join(missing)}.")
    if unknown:
        problems.append(f"Colonnes inconnues : {', '.join(unknown)}.")
    if duplicated:
        problems.append(f"Colonnes en double : {', '.join(duplicated)}.")
    if problems:
        raise ValidationError({"file": problems})

    rows = []
    for values in reader:
        line = reader.line_num
        if not any(value.strip() for value in values):
            continue  # blank line
        if len(values) != len(header):
            raise ValidationError(
                {"file": f"Ligne {line} : {len(values)} colonne(s) au lieu de {len(header)}."}
            )
        if len(rows) >= MAX_ROWS:
            raise ValidationError({"file": f"Le fichier ne doit pas dépasser {MAX_ROWS} lignes."})
        rows.append((line, {name: _clean(value) for name, value in zip(header, values) if name in ALLOWED_COLUMNS}))
    if not rows:
        raise ValidationError({"file": "Le fichier ne contient aucune ligne de données."})
    return rows, [name for name in header if name in IGNORED_COLUMNS]


def validate_rows(rows):
    """Validate every row with the same rules as a manual creation. Nothing is written."""
    departments = {d.code: d for d in Department.objects.all()}
    positions = {p.code: p for p in Position.objects.all()}
    seen_matricules, seen_emails = {}, {}
    result = ImportResult()

    for line, row in rows:
        errors = {}
        department = departments.get(row.get("department_code", "").upper())
        position = positions.get(row.get("position_code", "").upper())
        if department is None:
            errors["department_code"] = ["Département inconnu."]
        if position is None:
            errors["position_code"] = ["Poste inconnu."]

        payload = {
            key: value
            for key, value in row.items()
            if key not in COLUMN_OF_FIELD.values() and value != ""
        }
        if department:
            payload["department"] = department.pk
        if position:
            payload["position"] = position.pk

        serializer = EmployeeCreateSerializer(data=payload)
        if not serializer.is_valid():
            for name, messages in serializer.errors.items():
                column = COLUMN_OF_FIELD.get(name, name)
                if column in errors:  # already reported as an unknown code
                    continue
                errors.setdefault(column, []).extend(_texts(messages))

        # Duplicates inside the file itself.
        matricule = row.get("matricule", "").upper()
        if matricule:
            if matricule in seen_matricules:
                errors.setdefault("matricule", []).append(
                    f"Doublon dans le fichier (déjà présent ligne {seen_matricules[matricule]})."
                )
            else:
                seen_matricules[matricule] = line
        email = row.get("work_email", "").lower()
        if email:
            if email in seen_emails:
                errors.setdefault("work_email", []).append(
                    f"Doublon dans le fichier (déjà présent ligne {seen_emails[email]})."
                )
            else:
                seen_emails[email] = line

        if not errors:
            try:
                services.check_assignment_target(department, position)
            except ValidationError as exc:
                for name, messages in exc.detail.items():
                    errors.setdefault(COLUMN_OF_FIELD.get(name, name), []).extend(_texts(messages))

        if errors:
            result.error_count += 1
            if len(result.errors) < MAX_REPORTED_ERRORS:
                result.errors.append({"line": line, "errors": errors})
        else:
            result.rows.append((line, serializer.validated_data))
    return result


@transaction.atomic
def import_employees(*, rows, actor, request=None):
    """All-or-nothing creation of the validated rows (same path as a manual creation)."""
    for _, data in rows:
        services.create_employee(data=dict(data), actor=actor, request=request)
    audit.record(
        action=AuditAction.EMPLOYEES_IMPORTED, actor=actor, request=request, metadata={"rows": len(rows)}
    )
    return len(rows)