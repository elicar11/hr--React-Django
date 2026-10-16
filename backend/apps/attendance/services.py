import logging
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError

# Imported here to avoid a circular import (leaves depends on attendance).
from apps.leaves.models import LeaveRequest, LeaveStatus

from apps.core import audit
from apps.core.models import AuditAction
from apps.employees.models import Employee, EmploymentStatus

from .calculations import compute_metrics
from .models import (
    AttendanceCorrection,
    AttendanceRecord,
    AttendanceSource,
    AttendanceStatus,
    CorrectionStatus,
    Holiday,
    ScheduleAssignment,
    WorkSchedule,
)

logger = logging.getLogger(__name__)

DAY = timedelta(days=1)
NO_SCHEDULE_MESSAGE = (
    "Aucun horaire de travail applicable : définissez un horaire par défaut "
    "ou affectez-en un à l'employé."
)


# --- Helpers ---------------------------------------------------------------------


def get_employee_for_user(user):
    employee = Employee.objects.filter(user=user).first()
    if employee is None:
        raise NotFound("Aucun dossier employé n'est associé à votre compte.")
    return employee


def _lock_employee(employee):
    """Row lock: attendance changes of one employee are serialized (no double records)."""
    return Employee.objects.select_for_update().get(pk=employee.pk)


def resolve_schedule(employee, day):
    """Schedule assigned to the employee on `day`, else the default schedule (else None)."""
    assignment = (
        ScheduleAssignment.objects.select_related("schedule")
        .filter(employee=employee, start_date__lte=day)
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=day))
        .first()
    )
    if assignment:
        return assignment.schedule
    return WorkSchedule.objects.filter(is_default=True).first()


def is_working_day(schedule, day):
    return day.weekday() in schedule.working_days and not Holiday.objects.filter(date=day).exists()


def _ensure_can_clock(employee):
    if employee.employment_status != EmploymentStatus.ACTIVE:
        raise ValidationError("Votre dossier n'est pas en poste : le pointage est impossible.")


def _validate_employment(employee, day):
    if day < employee.hire_date:
        raise ValidationError({"date": "Cette date précède l'embauche de l'employé."})
    if employee.departure_date and day > employee.departure_date:
        raise ValidationError({"date": "Cette date suit le départ de l'employé."})


def _validate_times(day, check_in, check_out):
    """Same-day, chronological and not-in-the-future (night shifts are not supported)."""
    now = timezone.now()
    errors = {}
    if timezone.localdate(check_in) != day:
        errors["check_in"] = "L'entrée doit avoir lieu le jour concerné."
    elif check_in > now:
        errors["check_in"] = "L'entrée ne peut pas être dans le futur."
    if check_out is not None:
        if check_out <= check_in:
            errors["check_out"] = "La sortie doit suivre l'entrée."
        elif timezone.localdate(check_out) != day:
            errors["check_out"] = "La sortie doit avoir lieu le même jour que l'entrée."
        elif check_out > now:
            errors["check_out"] = "La sortie ne peut pas être dans le futur."
    if errors:
        raise ValidationError(errors)


def _apply_presence(record, employee, day, check_in, check_out):
    schedule = resolve_schedule(employee, day)
    if schedule is None:
        raise ValidationError(NO_SCHEDULE_MESSAGE)
    metrics = compute_metrics(
        schedule=schedule,
        day=day,
        check_in=check_in,
        check_out=check_out,
        is_working_day=is_working_day(schedule, day),
    )
    record.status = AttendanceStatus.PRESENT
    record.schedule = schedule
    record.check_in = check_in
    record.check_out = check_out
    record.worked_minutes = metrics.worked_minutes
    record.late_minutes = metrics.late_minutes
    record.overtime_minutes = metrics.overtime_minutes
    record.absence_reason = ""


def _apply_absence(record, employee, day, status, reason):
    reason = (reason or "").strip()
    if status == AttendanceStatus.ABSENT_JUSTIFIED and not reason:
        raise ValidationError({"absence_reason": "Un motif est obligatoire pour une absence justifiée."})
    schedule = resolve_schedule(employee, day)
    if schedule is not None and not is_working_day(schedule, day):
        raise ValidationError({"date": "Ce jour n'est pas un jour travaillé pour cet employé."})
    record.status = status
    record.schedule = None
    record.check_in = None
    record.check_out = None
    record.worked_minutes = record.late_minutes = record.overtime_minutes = 0
    record.absence_reason = reason


def _fill(record, *, status, check_in, check_out, reason):
    employee, day = record.employee, record.date
    if status == AttendanceStatus.PRESENT:
        if check_in is None:
            raise ValidationError({"check_in": "L'entrée est obligatoire pour une présence."})
        _validate_times(day, check_in, check_out)
        _apply_presence(record, employee, day, check_in, check_out)
    else:
        if check_in is not None or check_out is not None:
            raise ValidationError("Une absence ne peut pas avoir d'horaires de pointage.")
        _apply_absence(record, employee, day, status, reason)


def _audit(action, target, *, actor=None, request=None, **metadata):
    audit.record(action=action, actor=actor, request=request, target=target, metadata=metadata)


# --- Clock in / out (self-service, server time) -------------------------------------


@transaction.atomic
def check_in(*, employee, actor, request=None):
    employee = _lock_employee(employee)
    _ensure_can_clock(employee)
    now = timezone.now()
    day = timezone.localdate(now)
    _validate_employment(employee, day)

    existing = AttendanceRecord.objects.filter(employee=employee, date=day).first()
    if existing:
        if existing.status == AttendanceStatus.PRESENT:
            at = timezone.localtime(existing.check_in).strftime("%H:%M")
            raise ValidationError(f"Entrée déjà enregistrée aujourd'hui à {at}.")
        raise ValidationError("Une absence est déjà enregistrée pour aujourd'hui : contactez les RH.")


    if LeaveRequest.objects.filter(
        employee=employee, status=LeaveStatus.APPROVED, start_date__lte=day, end_date__gte=day
    ).exists():
        raise ValidationError(
            "Vous êtes en congé aujourd'hui : le pointage est impossible. "
            "Contactez les RH si vous reprenez le travail."
        )
    record = AttendanceRecord(employee=employee, date=day, source=AttendanceSource.CLOCK)
    _apply_presence(record, employee, day, now, None)
    record.save()
    _audit(
        AuditAction.ATTENDANCE_CHECKED_IN, record, actor=actor, request=request,
        matricule=employee.matricule, date=day.isoformat(), late_minutes=record.late_minutes,
    )
    return record


@transaction.atomic
def check_out(*, employee, actor, request=None):
    employee = _lock_employee(employee)
    _ensure_can_clock(employee)
    now = timezone.now()
    day = timezone.localdate(now)

    record = AttendanceRecord.objects.filter(
        employee=employee, date=day, status=AttendanceStatus.PRESENT
    ).first()
    if record is None or record.check_in is None:
        raise ValidationError("Aucune entrée enregistrée aujourd'hui : pointez d'abord votre entrée.")
    if record.check_out is not None:
        at = timezone.localtime(record.check_out).strftime("%H:%M")
        raise ValidationError(f"Sortie déjà enregistrée aujourd'hui à {at}.")
    if now <= record.check_in:
        raise ValidationError("La sortie doit suivre l'entrée.")

    _apply_presence(record, employee, day, record.check_in, now)
    record.save()
    _audit(
        AuditAction.ATTENDANCE_CHECKED_OUT, record, actor=actor, request=request,
        matricule=employee.matricule, date=day.isoformat(),
        worked_minutes=record.worked_minutes, overtime_minutes=record.overtime_minutes,
    )
    return record


def today_overview(employee):
    day = timezone.localdate()
    schedule = resolve_schedule(employee, day)
    return {
        "date": day,
        "schedule": schedule,
        "is_working_day": bool(schedule and is_working_day(schedule, day)),
        "record": AttendanceRecord.objects.filter(employee=employee, date=day).first(),
    }


# --- Manual records (ADMIN / HR) --------------------------------------------------------


@transaction.atomic
def create_manual_record(*, data, actor, request=None):
    employee = _lock_employee(data["employee"])
    day = data["date"]
    if day > timezone.localdate():
        raise ValidationError({"date": "La date ne peut pas être dans le futur."})
    _validate_employment(employee, day)
    if AttendanceRecord.objects.filter(employee=employee, date=day).exists():
        raise ValidationError(
            {"date": "Un enregistrement existe déjà pour cet employé à cette date : modifiez-le."}
        )

    record = AttendanceRecord(employee=employee, date=day, source=AttendanceSource.MANUAL)
    _fill(
        record,
        status=data["status"],
        check_in=data.get("check_in"),
        check_out=data.get("check_out"),
        reason=data.get("absence_reason", ""),
    )
    record.save()
    _audit(
        AuditAction.ATTENDANCE_RECORD_CREATED, record, actor=actor, request=request,
        matricule=employee.matricule, date=day.isoformat(), status=record.status,
    )
    return record


@transaction.atomic
def update_record(*, record, data, actor, request=None):
    employee = _lock_employee(record.employee)
    record = AttendanceRecord.objects.select_for_update().get(pk=record.pk)
    record.employee = employee
    if "employee" in data and data["employee"].pk != record.employee_id:
        raise ValidationError({"employee": "L'employé d'un enregistrement ne peut pas être modifié."})
    if "date" in data and data["date"] != record.date:
        raise ValidationError({"date": "La date d'un enregistrement ne peut pas être modifiée."})

    # Only field names are audited, never their values.
    fields = ("status", "check_in", "check_out", "absence_reason")
    changed = [f for f in fields if f in data and getattr(record, f) != data[f]]

    status = data.get("status", record.status)
    if status == AttendanceStatus.PRESENT:
        check_in = data.get("check_in", record.check_in)
        check_out = data.get("check_out", record.check_out)
    else:  # switching to an absence never carries old clock times
        check_in, check_out = data.get("check_in"), data.get("check_out")
    _fill(
        record,
        status=status,
        check_in=check_in,
        check_out=check_out,
        reason=data.get("absence_reason", record.absence_reason),
    )
    if changed:
        record.source = AttendanceSource.MANUAL
    record.save()
    if changed:
        _audit(
            AuditAction.ATTENDANCE_RECORD_UPDATED, record, actor=actor, request=request,
            matricule=employee.matricule, date=record.date.isoformat(), fields=changed,
        )
    return record


@transaction.atomic
def delete_record(*, record, actor, request=None):
    """Only absences can be deleted; a presence must be corrected, not erased."""
    record = AttendanceRecord.objects.select_for_update().select_related("employee").get(pk=record.pk)
    if record.status == AttendanceStatus.PRESENT:
        raise ValidationError("Un pointage ne peut pas être supprimé : corrigez-le.")
    _audit(
        AuditAction.ATTENDANCE_RECORD_DELETED, record, actor=actor, request=request,
        matricule=record.employee.matricule, date=record.date.isoformat(), status=record.status,
    )
    record.delete()


# --- Corrections (employee request, ADMIN / HR decision) -------------------------------


@transaction.atomic
def request_correction(*, employee, data, actor, request=None):
    employee = _lock_employee(employee)
    _ensure_can_clock(employee)
    today = timezone.localdate()
    day = data["date"]
    window = settings.ATTENDANCE_CORRECTION_WINDOW_DAYS
    if day > today:
        raise ValidationError({"date": "La date ne peut pas être dans le futur."})
    if day < today - timedelta(days=window):
        raise ValidationError({"date": f"Les corrections ne sont possibles que sur les {window} derniers jours."})
    _validate_employment(employee, day)
    _validate_times(day, data["check_in"], data.get("check_out"))
    if resolve_schedule(employee, day) is None:
        raise ValidationError(NO_SCHEDULE_MESSAGE)
    if AttendanceCorrection.objects.filter(
        employee=employee, date=day, status=CorrectionStatus.PENDING
    ).exists():
        raise ValidationError({"date": "Une demande est déjà en attente pour cette date."})

    correction = AttendanceCorrection.objects.create(
        employee=employee,
        date=day,
        check_in=data["check_in"],
        check_out=data.get("check_out"),
        reason=data["reason"],
        requested_by=actor,
    )
    _audit(
        AuditAction.ATTENDANCE_CORRECTION_REQUESTED, correction, actor=actor, request=request,
        matricule=employee.matricule, date=day.isoformat(),
    )
    return correction


def _pending_correction(correction):
    """Lock the employee, then the correction; make sure it can still be decided."""
    employee = _lock_employee(correction.employee)
    correction = AttendanceCorrection.objects.select_for_update().get(pk=correction.pk)
    if correction.status != CorrectionStatus.PENDING:
        raise ValidationError("Cette demande a déjà été traitée.")
    return employee, correction


@transaction.atomic
def approve_correction(*, correction, comment, actor, request=None):
    employee, correction = _pending_correction(correction)
    if employee.user_id == actor.pk:
        raise ValidationError("Vous ne pouvez pas valider votre propre demande.")
    _validate_employment(employee, correction.date)
    _validate_times(correction.date, correction.check_in, correction.check_out)

    record = AttendanceRecord.objects.select_for_update().filter(
        employee=employee, date=correction.date
    ).first() or AttendanceRecord(employee=employee, date=correction.date)
    record.source = AttendanceSource.MANUAL
    _apply_presence(record, employee, correction.date, correction.check_in, correction.check_out)
    record.save()

    correction.status = CorrectionStatus.APPROVED
    correction.decided_by = actor
    correction.decided_at = timezone.now()
    correction.decision_comment = comment
    correction.save(update_fields=["status", "decided_by", "decided_at", "decision_comment"])
    _audit(
        AuditAction.ATTENDANCE_CORRECTION_APPROVED, correction, actor=actor, request=request,
        matricule=employee.matricule, date=correction.date.isoformat(),
    )
    return correction


@transaction.atomic
def reject_correction(*, correction, comment, actor, request=None):
    employee, correction = _pending_correction(correction)
    if employee.user_id == actor.pk:
        raise ValidationError("Vous ne pouvez pas traiter votre propre demande.")
    correction.status = CorrectionStatus.REJECTED
    correction.decided_by = actor
    correction.decided_at = timezone.now()
    correction.decision_comment = comment
    correction.save(update_fields=["status", "decided_by", "decided_at", "decision_comment"])
    _audit(
        AuditAction.ATTENDANCE_CORRECTION_REJECTED, correction, actor=actor, request=request,
        matricule=employee.matricule, date=correction.date.isoformat(),
    )
    return correction


@transaction.atomic
def cancel_correction(*, correction, actor, request=None):
    employee, correction = _pending_correction(correction)
    if employee.user_id != actor.pk:
        raise ValidationError("Seul l'employé concerné peut annuler sa demande.")
    correction.status = CorrectionStatus.CANCELLED
    correction.decided_at = timezone.now()
    correction.save(update_fields=["status", "decided_at"])
    _audit(
        AuditAction.ATTENDANCE_CORRECTION_CANCELLED, correction, actor=actor, request=request,
        matricule=employee.matricule, date=correction.date.isoformat(),
    )
    return correction


# --- Schedules --------------------------------------------------------------------------


@transaction.atomic
def set_default_schedule(*, schedule, actor, request=None):
    WorkSchedule.objects.filter(is_default=True).exclude(pk=schedule.pk).update(is_default=False)
    schedule.is_default = True
    schedule.save(update_fields=["is_default", "updated_at"])
    _audit(
        AuditAction.WORK_SCHEDULE_DEFAULT_SET, schedule, actor=actor, request=request, code=schedule.code
    )
    return schedule


@transaction.atomic
def assign_schedule(*, employee, schedule, start_date, actor, request=None):
    employee = _lock_employee(employee)
    if employee.employment_status == EmploymentStatus.TERMINATED:
        raise ValidationError("Impossible d'affecter un horaire à un employé sorti.")
    current = employee.schedule_assignments.filter(end_date__isnull=True).first()
    if current:
        if start_date <= current.start_date:
            raise ValidationError(
                {"start_date": f"La date d'effet doit être postérieure au {current.start_date.isoformat()}."}
            )
        if current.schedule_id == schedule.pk:
            raise ValidationError("Cet horaire est déjà celui de l'employé.")
        current.end_date = start_date - DAY
        current.save(update_fields=["end_date"])
    assignment = ScheduleAssignment.objects.create(
        employee=employee, schedule=schedule, start_date=start_date
    )
    _audit(
        AuditAction.SCHEDULE_ASSIGNED, assignment, actor=actor, request=request,
        matricule=employee.matricule, schedule=schedule.code, start_date=start_date.isoformat(),
    )
    return assignment


# --- Daily job: absences without clock data -----------------------------------------------


def mark_missing_absences(*, day):
    """Create an unjustified absence for working days without any record.

    Runs for a finished day. Employees on approved leave are not absent: they are skipped.
    """
    # Imported here to avoid a circular import (leaves depends on attendance).
    from apps.leaves.models import LeaveRequest, LeaveStatus

    if day >= timezone.localdate():
        raise ValidationError("Seules les journées terminées peuvent être traitées.")
    created = 0
    if not Holiday.objects.filter(date=day).exists():
        on_leave = set(
            LeaveRequest.objects.filter(
                status=LeaveStatus.APPROVED, start_date__lte=day, end_date__gte=day
            ).values_list("employee_id", flat=True)
        )
        employees = Employee.objects.filter(
            employment_status=EmploymentStatus.ACTIVE, hire_date__lte=day
        ).filter(Q(departure_date__isnull=True) | Q(departure_date__gte=day))
        for employee in employees.iterator():
            if employee.pk in on_leave:
                continue
            schedule = resolve_schedule(employee, day)
            if schedule is None or day.weekday() not in schedule.working_days:
                continue
            _, was_created = AttendanceRecord.objects.get_or_create(
                employee=employee,
                date=day,
                defaults={
                    "status": AttendanceStatus.ABSENT_UNJUSTIFIED,
                    "source": AttendanceSource.SYSTEM,
                },
            )
            created += int(was_created)
    audit.record(
        action=AuditAction.ATTENDANCE_ABSENCES_MARKED,
        metadata={"date": day.isoformat(), "count": created, "source": "system"},
    )
    logger.info("missing_absences_marked date=%s count=%s", day.isoformat(), created)
    return created
    """Create an unjustified absence for working days without any record.

    Runs for a finished day. (Approved leaves will be excluded once the leave module exists.)
    """
    if day >= timezone.localdate():
        raise ValidationError("Seules les journées terminées peuvent être traitées.")
    created = 0
    if not Holiday.objects.filter(date=day).exists():
        employees = Employee.objects.filter(
            employment_status=EmploymentStatus.ACTIVE, hire_date__lte=day
        ).filter(Q(departure_date__isnull=True) | Q(departure_date__gte=day))
        for employee in employees.iterator():
            schedule = resolve_schedule(employee, day)
            if schedule is None or day.weekday() not in schedule.working_days:
                continue
            _, was_created = AttendanceRecord.objects.get_or_create(
                employee=employee,
                date=day,
                defaults={
                    "status": AttendanceStatus.ABSENT_UNJUSTIFIED,
                    "source": AttendanceSource.SYSTEM,
                },
            )
            created += int(was_created)
    audit.record(
        action=AuditAction.ATTENDANCE_ABSENCES_MARKED,
        metadata={"date": day.isoformat(), "count": created, "source": "system"},
    )
    logger.info("missing_absences_marked date=%s count=%s", day.isoformat(), created)
    return created

def scheduled_working_days(employee, start, end):
    """Working days of the employee between `start` and `end` (inclusive).

    Follows the schedule(s) assigned to the employee over the period (default schedule
    otherwise) and excludes holidays. Queries are done once for the whole period.
    """
    assignments = list(
        ScheduleAssignment.objects.select_related("schedule")
        .filter(employee=employee, start_date__lte=end)
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=start))
    )
    default = WorkSchedule.objects.filter(is_default=True).first()
    holidays = set(Holiday.objects.filter(date__range=(start, end)).values_list("date", flat=True))

    days = []
    day = start
    while day <= end:
        schedule = next(
            (
                a.schedule
                for a in assignments
                if a.start_date <= day and (a.end_date is None or a.end_date >= day)
            ),
            default,
        )
        if schedule is None:
            raise ValidationError(NO_SCHEDULE_MESSAGE)
        if day.weekday() in schedule.working_days and day not in holidays:
            days.append(day)
        day += DAY
    return days