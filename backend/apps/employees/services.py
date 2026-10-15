import logging
from datetime import timedelta

from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.accounts import services as account_services
from apps.core import audit
from apps.core.models import AuditAction

# Close the employee's running contracts (imported here to avoid a circular import).
from apps.contracts import services as contract_services

from .models import Employee, EmployeeAssignment, EmploymentStatus

logger = logging.getLogger(__name__)


def _lock(employee):
    """Reload the employee with a row lock, so concurrent status/assignment changes are serialized."""
    return Employee.objects.select_for_update().get(pk=employee.pk)


def check_assignment_target(department, position):
    """A new assignment needs an active department and an active position of that department."""
    if not department.is_active:
        raise ValidationError({"department": "Le département doit être actif."})
    if not position.is_active:
        raise ValidationError({"position": "Le poste doit être actif."})
    if position.department_id is not None and position.department_id != department.pk:
        raise ValidationError({"position": "Ce poste est rattaché à un autre département."})


@transaction.atomic
def create_employee(*, data, actor, request=None):
    check_assignment_target(data["department"], data["position"])
    employee = Employee.objects.create(**data)
    EmployeeAssignment.objects.create(
        employee=employee,
        department=employee.department,
        position=employee.position,
        start_date=employee.hire_date,
    )
    audit.record(
        action=AuditAction.EMPLOYEE_CREATED,
        actor=actor,
        request=request,
        target=employee,
        metadata={"matricule": employee.matricule},
    )
    logger.info("employee_created actor=%s employee=%s", actor.pk, employee.pk)
    return employee


def _move_hire_date(employee, new_date):
    """Keep the first assignment aligned when the hire date is corrected."""
    if employee.departure_date and new_date > employee.departure_date:
        raise ValidationError({"hire_date": "La date d'embauche ne peut pas suivre la date de départ."})
    assignments = list(employee.assignments.order_by("start_date"))
    if len(assignments) > 1 and new_date >= assignments[1].start_date:
        raise ValidationError(
            {"hire_date": "La date d'embauche doit précéder la première réaffectation."}
        )
    first = assignments[0]
    first.start_date = new_date
    first.save(update_fields=["start_date"])


@transaction.atomic
def update_employee(*, employee, data, actor, request=None):
    """Update personal data. Assignment and status are NOT editable here."""
    employee = _lock(employee)
    # Only field names are audited, never their values.
    changed = [field for field, value in data.items() if getattr(employee, field) != value]
    if "hire_date" in changed:
        _move_hire_date(employee, data["hire_date"])
    for field, value in data.items():
        setattr(employee, field, value)
    employee.save()
    if changed:
        audit.record(
            action=AuditAction.EMPLOYEE_UPDATED,
            actor=actor,
            request=request,
            target=employee,
            metadata={"matricule": employee.matricule, "fields": changed},
        )
    return employee


@transaction.atomic
def assign(*, employee, department, position, start_date, actor, request=None):
    """Move an employee to a new department / position, keeping the history."""
    employee = _lock(employee)
    if employee.employment_status == EmploymentStatus.TERMINATED:
        raise ValidationError("Impossible de réaffecter un employé sorti.")
    check_assignment_target(department, position)
    if start_date < employee.hire_date:
        raise ValidationError({"start_date": "La date d'effet ne peut pas précéder la date d'embauche."})

    current = employee.assignments.filter(end_date__isnull=True).first()
    if current:
        if start_date <= current.start_date:
            raise ValidationError(
                {"start_date": f"La date d'effet doit être postérieure au {current.start_date.isoformat()}."}
            )
        if current.department_id == department.pk and current.position_id == position.pk:
            raise ValidationError("Cette affectation est identique à l'affectation actuelle.")
        current.end_date = start_date - timedelta(days=1)
        current.save(update_fields=["end_date"])

    previous = {"department": employee.department.code, "position": employee.position.code}
    EmployeeAssignment.objects.create(
        employee=employee, department=department, position=position, start_date=start_date
    )
    employee.department = department
    employee.position = position
    employee.save(update_fields=["department", "position", "updated_at"])

    audit.record(
        action=AuditAction.EMPLOYEE_ASSIGNED,
        actor=actor,
        request=request,
        target=employee,
        metadata={
            "matricule": employee.matricule,
            "from": previous,
            "to": {"department": department.code, "position": position.code},
            "start_date": start_date.isoformat(),
        },
    )
    return employee


@transaction.atomic
def suspend(*, employee, actor, request=None):
    employee = _lock(employee)
    if employee.employment_status != EmploymentStatus.ACTIVE:
        raise ValidationError("Seul un employé en poste peut être suspendu.")
    employee.employment_status = EmploymentStatus.SUSPENDED
    employee.save(update_fields=["employment_status", "updated_at"])
    audit.record(
        action=AuditAction.EMPLOYEE_SUSPENDED,
        actor=actor,
        request=request,
        target=employee,
        metadata={"matricule": employee.matricule},
    )
    return employee


@transaction.atomic
def terminate(*, employee, departure_date, actor, request=None):
    """Record a departure: closes the open assignment and deactivates the linked login account."""
    employee = _lock(employee)
    if employee.employment_status == EmploymentStatus.TERMINATED:
        raise ValidationError("Cet employé est déjà sorti.")
    if employee.user_id == actor.pk:
        raise ValidationError("Vous ne pouvez pas clôturer votre propre dossier.")

    latest = employee.assignments.order_by("-start_date").first()
    floor = max(employee.hire_date, latest.start_date) if latest else employee.hire_date
    if departure_date < floor:
        raise ValidationError(
            {"departure_date": f"La date de départ ne peut pas précéder le {floor.isoformat()}."}
        )

    employee.employment_status = EmploymentStatus.TERMINATED
    employee.departure_date = departure_date
    employee.save(update_fields=["employment_status", "departure_date", "updated_at"])
    if latest and latest.end_date is None:
        latest.end_date = departure_date
        latest.save(update_fields=["end_date"])
        contract_services.close_contracts_for_departure(
        employee=employee, departure_date=departure_date, actor=actor, request=request
    )

    # Revoke access with the employment relationship.
    if employee.user and employee.user.is_active:
        account_services.set_user_active(
            actor=actor, user=employee.user, is_active=False, request=request
        )

    audit.record(
        action=AuditAction.EMPLOYEE_TERMINATED,
        actor=actor,
        request=request,
        target=employee,
        metadata={"matricule": employee.matricule, "departure_date": departure_date.isoformat()},
    )
    logger.info("employee_terminated actor=%s employee=%s", actor.pk, employee.pk)
    return employee


@transaction.atomic
def reactivate(*, employee, actor, request=None):
    """Back to ACTIVE (correction of a mistake). The login account must be re-enabled separately."""
    employee = _lock(employee)
    if employee.employment_status == EmploymentStatus.ACTIVE:
        raise ValidationError("Cet employé est déjà en poste.")

    if employee.employment_status == EmploymentStatus.TERMINATED:
        last = employee.assignments.select_related("department", "position").order_by("-start_date").first()
        if last is None or not (last.department.is_active and last.position.is_active):
            raise ValidationError(
                "Le département ou le poste de la dernière affectation est inactif : réactivez-les d'abord."
            )
        last.end_date = None
        last.save(update_fields=["end_date"])
        employee.departure_date = None

    employee.employment_status = EmploymentStatus.ACTIVE
    employee.save(update_fields=["employment_status", "departure_date", "updated_at"])
    audit.record(
        action=AuditAction.EMPLOYEE_REACTIVATED,
        actor=actor,
        request=request,
        target=employee,
        metadata={"matricule": employee.matricule},
    )
    return employee


@transaction.atomic
def set_photo(*, employee, photo, actor, request=None):
    employee = _lock(employee)
    old_name = employee.photo.name
    storage = employee.photo.storage
    employee.photo = photo
    employee.save(update_fields=["photo", "updated_at"])
    if old_name:  # delete the previous file only once the DB change is committed
        transaction.on_commit(lambda: storage.delete(old_name))
    audit.record(
        action=AuditAction.EMPLOYEE_PHOTO_UPDATED,
        actor=actor,
        request=request,
        target=employee,
        metadata={"matricule": employee.matricule},
    )
    return employee


@transaction.atomic
def remove_photo(*, employee, actor, request=None):
    employee = _lock(employee)
    old_name = employee.photo.name
    storage = employee.photo.storage
    employee.photo = ""
    employee.save(update_fields=["photo", "updated_at"])
    if old_name:
        transaction.on_commit(lambda: storage.delete(old_name))
    audit.record(
        action=AuditAction.EMPLOYEE_PHOTO_REMOVED,
        actor=actor,
        request=request,
        target=employee,
        metadata={"matricule": employee.matricule},
    )
    return employee