import logging
from collections import defaultdict
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models import Role
from apps.attendance import services as attendance_services
from apps.attendance.models import AttendanceRecord, AttendanceSource, AttendanceStatus
from apps.core import audit
from apps.core.models import AuditAction
from apps.employees.models import Employee, EmploymentStatus

from .models import (
    DayCountMode,
    LeaveBalance,
    LeaveDocument,
    LeaveHistoryAction,
    LeaveRequest,
    LeaveRequestHistory,
    LeaveStatus,
    LeaveType,
)

logger = logging.getLogger(__name__)

DAY = timedelta(days=1)
MAX_LEAVE_SPAN_DAYS = 366
OPEN_STATUSES = (LeaveStatus.PENDING, LeaveStatus.APPROVED)


# --- Helpers ----------------------------------------------------------------------------


def _is_hr(user):
    return user.role in (Role.ADMIN, Role.HR)


def _lock_employee(employee):
    """Row lock: leave changes of one employee are serialized (overlap and balance checks stay reliable)."""
    return Employee.objects.select_for_update().get(pk=employee.pk)


def _lock_request(leave):
    return LeaveRequest.objects.select_for_update().get(pk=leave.pk)


def _ensure_owner_or_hr(employee, actor):
    if not (_is_hr(actor) or employee.user_id == actor.pk):
        raise PermissionDenied("Vous n'avez pas les droits nécessaires pour cette opération.")


def _history(leave, action, actor, *, comment="", from_status="", to_status=""):
    LeaveRequestHistory.objects.create(
        request=leave,
        action=action,
        actor=actor,
        actor_email=actor.email if actor else "",
        from_status=from_status,
        to_status=to_status,
        comment=comment,
    )


def _audit(action, leave, *, actor=None, request=None, **metadata):
    # Reasons and comments are never written to the audit trail.
    audit.record(
        action=action,
        actor=actor,
        request=request,
        target=leave,
        metadata={
            "matricule": leave.employee.matricule,
            "start_date": leave.start_date.isoformat(),
            "end_date": leave.end_date.isoformat(),
            "days": str(leave.days),
            **metadata,
        },
    )


# --- Day count and balances -------------------------------------------------------------------


def compute_days(employee, leave_type, start, end):
    """Days counted for the period, and their split by calendar year (computed by the backend)."""
    if leave_type.day_count_mode == DayCountMode.CALENDAR_DAYS:
        days = [start + timedelta(days=i) for i in range((end - start).days + 1)]
    else:
        days = attendance_services.scheduled_working_days(employee, start, end)
    if not days:
        raise ValidationError(
            {"start_date": "Cette période ne contient aucun jour décompté (week-end ou jours fériés)."}
        )
    by_year = defaultdict(int)
    for day in days:
        by_year[day.year] += 1
    return Decimal(len(days)), {str(year): str(count) for year, count in sorted(by_year.items())}


def validate_request_terms(*, employee, leave_type, start, end, exclude_pk=None):
    if employee.employment_status != EmploymentStatus.ACTIVE:
        raise ValidationError("Cet employé n'est pas en poste : aucune demande n'est possible.")
    if not leave_type.is_active:
        raise ValidationError({"leave_type": "Ce type de congé est inactif."})
    if end < start:
        raise ValidationError({"end_date": "La date de fin doit être postérieure ou égale à la date de début."})
    if (end - start).days + 1 > MAX_LEAVE_SPAN_DAYS:
        raise ValidationError({"end_date": f"Une demande ne peut pas dépasser {MAX_LEAVE_SPAN_DAYS} jours."})
    if start < employee.hire_date:
        raise ValidationError({"start_date": "La période précède la date d'embauche."})

    overlap = (
        LeaveRequest.objects.filter(
            employee=employee, status__in=OPEN_STATUSES, start_date__lte=end, end_date__gte=start
        )
        .exclude(pk=exclude_pk)
        .first()
    )
    if overlap:
        raise ValidationError(
            {
                "start_date": "Cette période chevauche une demande existante "
                f"({overlap.start_date.isoformat()} → {overlap.end_date.isoformat()}, "
                f"{overlap.get_status_display().lower()})."
            }
        )


def _check_balances(employee, leave_type, days_by_year, *, lock):
    """Ensure each year has enough remaining days. Years are visited in order (stable lock order)."""
    balances = {}
    if not leave_type.uses_balance:
        return balances
    for year in sorted(days_by_year):
        queryset = LeaveBalance.objects.filter(employee=employee, leave_type=leave_type, year=int(year))
        if lock:
            queryset = queryset.select_for_update()
        balance = queryset.first()
        needed = Decimal(days_by_year[year])
        if balance is None:
            raise ValidationError({"leave_type": f"Aucun solde défini pour {year} : contactez les RH."})
        if balance.remaining < needed:
            raise ValidationError(
                {"leave_type": f"Solde insuffisant pour {year} (restant : {balance.remaining}, demandé : {needed})."}
            )
        balances[year] = balance
    return balances


def _refund_balances(employee, leave):
    if not leave.leave_type.uses_balance:
        return
    for year in sorted(leave.days_by_year):
        balance = (
            LeaveBalance.objects.select_for_update()
            .filter(employee=employee, leave_type=leave.leave_type, year=int(year))
            .first()
        )
        if balance is None:
            continue
        balance.used = max(Decimal("0"), balance.used - Decimal(leave.days_by_year[year]))
        balance.save(update_fields=["used", "updated_at"])


# --- Requests ---------------------------------------------------------------------------------


@transaction.atomic
def create_request(*, employee, data, actor, request=None):
    employee = _lock_employee(employee)
    leave_type, start, end = data["leave_type"], data["start_date"], data["end_date"]
    validate_request_terms(employee=employee, leave_type=leave_type, start=start, end=end)
    days, by_year = compute_days(employee, leave_type, start, end)
    _check_balances(employee, leave_type, by_year, lock=False)

    leave = LeaveRequest.objects.create(
        employee=employee,
        leave_type=leave_type,
        start_date=start,
        end_date=end,
        days=days,
        days_by_year=by_year,
        reason=data.get("reason", ""),
        requested_by=actor,
    )
    _history(leave, LeaveHistoryAction.CREATED, actor, to_status=LeaveStatus.PENDING)
    _audit(AuditAction.LEAVE_REQUESTED, leave, actor=actor, request=request, leave_type=leave_type.code)
    logger.info("leave_requested actor=%s leave=%s", actor.pk, leave.pk)
    return leave


@transaction.atomic
def update_request(*, leave, data, actor, request=None):
    """Edit a pending request; the day count is recomputed."""
    employee = _lock_employee(leave.employee)
    leave = _lock_request(leave)
    _ensure_owner_or_hr(employee, actor)
    if leave.status != LeaveStatus.PENDING:
        raise ValidationError(
            "Seule une demande en attente peut être modifiée. Annulez-la puis créez-en une nouvelle."
        )
    leave_type = data.get("leave_type", leave.leave_type)
    start = data.get("start_date", leave.start_date)
    end = data.get("end_date", leave.end_date)
    validate_request_terms(
        employee=employee, leave_type=leave_type, start=start, end=end, exclude_pk=leave.pk
    )
    days, by_year = compute_days(employee, leave_type, start, end)
    _check_balances(employee, leave_type, by_year, lock=False)

    changed = [f for f in ("leave_type", "start_date", "end_date", "reason") if f in data and getattr(leave, f) != data[f]]
    leave.leave_type, leave.start_date, leave.end_date = leave_type, start, end
    leave.days, leave.days_by_year = days, by_year
    if "reason" in data:
        leave.reason = data["reason"]
    leave.save()
    if changed:
        _history(leave, LeaveHistoryAction.UPDATED, actor, from_status=LeaveStatus.PENDING, to_status=LeaveStatus.PENDING)
        _audit(AuditAction.LEAVE_UPDATED, leave, actor=actor, request=request, fields=changed)
    return leave


@transaction.atomic
def approve_request(*, leave, comment, actor, request=None):
    employee = _lock_employee(leave.employee)
    leave = _lock_request(leave)
    if leave.status != LeaveStatus.PENDING:
        raise ValidationError("Cette demande a déjà été traitée.")
    if employee.user_id == actor.pk:
        raise ValidationError("Vous ne pouvez pas valider votre propre demande.")
    if employee.employment_status != EmploymentStatus.ACTIVE:
        raise ValidationError("Cet employé n'est plus en poste.")
    leave_type = leave.leave_type
    if leave_type.requires_document and not leave.documents.exists():
        raise ValidationError("Un justificatif est obligatoire pour ce type de congé.")

    overlap = (
        LeaveRequest.objects.filter(
            employee=employee, status__in=OPEN_STATUSES,
            start_date__lte=leave.end_date, end_date__gte=leave.start_date,
        )
        .exclude(pk=leave.pk)
        .exists()
    )
    if overlap:
        raise ValidationError("Cette période chevauche une autre demande de l'employé.")

    # Attendance: system-generated unjustified absences are covered by the leave; any other record blocks.
    in_range = AttendanceRecord.objects.filter(
        employee=employee, date__range=(leave.start_date, leave.end_date)
    )
    blocking = in_range.exclude(status=AttendanceStatus.ABSENT_UNJUSTIFIED, source=AttendanceSource.SYSTEM)
    first = blocking.order_by("date").first()
    if first:
        raise ValidationError(
            f"Un enregistrement de présence existe le {first.date.isoformat()} : "
            "corrigez-le avant d'approuver ce congé."
        )

    # Authoritative balance check under lock, then update in the same transaction.
    balances = _check_balances(employee, leave_type, leave.days_by_year, lock=True)
    for year, balance in balances.items():
        balance.used += Decimal(leave.days_by_year[year])
        balance.save(update_fields=["used", "updated_at"])

    in_range.filter(status=AttendanceStatus.ABSENT_UNJUSTIFIED, source=AttendanceSource.SYSTEM).delete()

    leave.status = LeaveStatus.APPROVED
    leave.decided_by = actor
    leave.decided_at = timezone.now()
    leave.decision_comment = comment
    leave.save(update_fields=["status", "decided_by", "decided_at", "decision_comment", "updated_at"])
    _history(
        leave, LeaveHistoryAction.APPROVED, actor,
        comment=comment, from_status=LeaveStatus.PENDING, to_status=LeaveStatus.APPROVED,
    )
    _audit(AuditAction.LEAVE_APPROVED, leave, actor=actor, request=request, leave_type=leave_type.code)
    logger.info("leave_approved actor=%s leave=%s", actor.pk, leave.pk)
    return leave


@transaction.atomic
def reject_request(*, leave, comment, actor, request=None):
    employee = _lock_employee(leave.employee)
    leave = _lock_request(leave)
    if leave.status != LeaveStatus.PENDING:
        raise ValidationError("Cette demande a déjà été traitée.")
    if employee.user_id == actor.pk:
        raise ValidationError("Vous ne pouvez pas traiter votre propre demande.")
    leave.status = LeaveStatus.REJECTED
    leave.decided_by = actor
    leave.decided_at = timezone.now()
    leave.decision_comment = comment
    leave.save(update_fields=["status", "decided_by", "decided_at", "decision_comment", "updated_at"])
    _history(
        leave, LeaveHistoryAction.REJECTED, actor,
        comment=comment, from_status=LeaveStatus.PENDING, to_status=LeaveStatus.REJECTED,
    )
    _audit(AuditAction.LEAVE_REJECTED, leave, actor=actor, request=request)
    return leave


@transaction.atomic
def cancel_request(*, leave, comment, actor, request=None):
    employee = _lock_employee(leave.employee)
    leave = _lock_request(leave)
    is_owner = employee.user_id == actor.pk

    if leave.status == LeaveStatus.PENDING:
        _ensure_owner_or_hr(employee, actor)
    elif leave.status == LeaveStatus.APPROVED:
        if not _is_hr(actor):
            if not is_owner:
                raise PermissionDenied("Vous n'avez pas les droits nécessaires pour cette opération.")
            if leave.start_date <= timezone.localdate():
                raise ValidationError("Un congé commencé ne peut être annulé que par les RH.")
    else:
        raise ValidationError("Cette demande ne peut plus être annulée.")

    previous = leave.status
    if previous == LeaveStatus.APPROVED:
        _refund_balances(employee, leave)
    leave.status = LeaveStatus.CANCELLED
    leave.decided_at = timezone.now()
    leave.decision_comment = comment
    leave.save(update_fields=["status", "decided_at", "decision_comment", "updated_at"])
    _history(
        leave, LeaveHistoryAction.CANCELLED, actor,
        comment=comment, from_status=previous, to_status=LeaveStatus.CANCELLED,
    )
    _audit(AuditAction.LEAVE_CANCELLED, leave, actor=actor, request=request, was=previous)
    return leave


def cancel_for_departure(*, employee, departure_date, actor, request=None):
    """Called when an employee leaves: pending and future approved requests are cancelled."""
    employee = _lock_employee(employee)
    leaves = LeaveRequest.objects.select_for_update().filter(employee=employee).filter(
        Q(status=LeaveStatus.PENDING) | Q(status=LeaveStatus.APPROVED, start_date__gt=departure_date)
    )
    for leave in leaves:
        previous = leave.status
        if previous == LeaveStatus.APPROVED:
            _refund_balances(employee, leave)
        leave.status = LeaveStatus.CANCELLED
        leave.decided_at = timezone.now()
        leave.decision_comment = "Départ de l'employé"
        leave.save(update_fields=["status", "decided_at", "decision_comment", "updated_at"])
        _history(
            leave, LeaveHistoryAction.CANCELLED, actor,
            comment=leave.decision_comment, from_status=previous, to_status=LeaveStatus.CANCELLED,
        )
        _audit(AuditAction.LEAVE_CANCELLED, leave, actor=actor, request=request, was=previous, reason="departure")


# --- Balances (ADMIN / HR) ------------------------------------------------------------------------


@transaction.atomic
def create_balance(*, data, actor, request=None):
    employee, leave_type = data["employee"], data["leave_type"]
    if not leave_type.uses_balance:
        raise ValidationError({"leave_type": "Ce type de congé n'est pas décompté d'un solde."})
    if LeaveBalance.objects.filter(employee=employee, leave_type=leave_type, year=data["year"]).exists():
        raise ValidationError("Un solde existe déjà pour cet employé, ce type et cette année : modifiez-le.")
    balance = LeaveBalance.objects.create(
        employee=employee, leave_type=leave_type, year=data["year"], allocated=data["allocated"]
    )
    audit.record(
        action=AuditAction.LEAVE_BALANCE_CREATED, actor=actor, request=request, target=balance,
        metadata={
            "matricule": employee.matricule, "leave_type": leave_type.code,
            "year": balance.year, "allocated": str(balance.allocated),
        },
    )
    return balance


@transaction.atomic
def update_balance(*, balance, allocated, actor, request=None):
    balance = LeaveBalance.objects.select_for_update().select_related("employee", "leave_type").get(pk=balance.pk)
    if allocated < balance.used:
        raise ValidationError(
            {"allocated": f"L'allocation ne peut pas être inférieure aux jours déjà utilisés ({balance.used})."}
        )
    previous = balance.allocated
    balance.allocated = allocated
    balance.save(update_fields=["allocated", "updated_at"])
    audit.record(
        action=AuditAction.LEAVE_BALANCE_UPDATED, actor=actor, request=request, target=balance,
        metadata={
            "matricule": balance.employee.matricule, "leave_type": balance.leave_type.code,
            "year": balance.year, "from": str(previous), "to": str(allocated),
        },
    )
    return balance


@transaction.atomic
def initialize_balances(*, year, actor, request=None):
    """Create the year's balances of active employees from each type's annual allowance (existing ones are kept)."""
    leave_types = list(
        LeaveType.objects.filter(is_active=True, uses_balance=True, annual_allowance__isnull=False)
    )
    created = 0
    employees = Employee.objects.filter(employment_status=EmploymentStatus.ACTIVE)
    for employee in employees.iterator():
        for leave_type in leave_types:
            _, was_created = LeaveBalance.objects.get_or_create(
                employee=employee,
                leave_type=leave_type,
                year=year,
                defaults={"allocated": leave_type.annual_allowance},
            )
            created += int(was_created)
    audit.record(
        action=AuditAction.LEAVE_BALANCES_INITIALIZED, actor=actor, request=request,
        metadata={"year": year, "created": created},
    )
    return created


# --- Documents -------------------------------------------------------------------------------------


@transaction.atomic
def add_document(*, leave, title, file, actor, request=None):
    leave = _lock_request(leave)
    _ensure_owner_or_hr(leave.employee, actor)
    if leave.status not in OPEN_STATUSES:
        raise ValidationError("Impossible d'ajouter un justificatif à une demande refusée ou annulée.")
    document = LeaveDocument.objects.create(request=leave, title=title, file=file, uploaded_by=actor)
    _audit(AuditAction.LEAVE_DOCUMENT_ADDED, leave, actor=actor, request=request, document_id=document.pk)
    return document


@transaction.atomic
def remove_document(*, document, actor, request=None):
    leave = _lock_request(document.request)
    _ensure_owner_or_hr(leave.employee, actor)
    if not _is_hr(actor) and leave.status != LeaveStatus.PENDING:
        raise PermissionDenied("Seuls les RH peuvent retirer un justificatif d'une demande déjà traitée.")
    document_id = document.pk
    storage, name = document.file.storage, document.file.name
    document.delete()
    transaction.on_commit(lambda: storage.delete(name))  # file removed once the DB change is committed
    _audit(AuditAction.LEAVE_DOCUMENT_REMOVED, leave, actor=actor, request=request, document_id=document_id)