from datetime import date, timedelta

from django.conf import settings
from django.db.models import Count, F, Q
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework.exceptions import NotFound

from apps.accounts.models import Role
from apps.attendance import services as attendance_services
from apps.attendance.models import AttendanceCorrection, AttendanceRecord, AttendanceStatus
from apps.contracts.models import Contract, ContractStatus
from apps.core.models import AuditLog
from apps.employees.models import Employee, EmploymentStatus
from apps.leaves.models import LeaveBalance, LeaveRequest, LeaveStatus
from apps.payroll.models import Payslip, PayslipStatus

ABSENT_STATUSES = [AttendanceStatus.ABSENT_JUSTIFIED, AttendanceStatus.ABSENT_UNJUSTIFIED]
# Audit events an HR user may see on the dashboard (an ADMIN sees everything).
HR_HIDDEN_ACTION_PREFIXES = ("auth.", "user.", "payroll.")
DEADLINES_LIMIT = 15
ACTIVITY_LIMIT = 10


# --- Helpers ----------------------------------------------------------------------------------------------


def _month_start(day):
    return day.replace(day=1)


def _next_month(day):
    return date(day.year + (day.month == 12), day.month % 12 + 1, 1)


def _ym(value):
    return value.strftime("%Y-%m")


def _by_month(queryset, field, start, end):
    """{'2026-03': n, ...}: rows per month of a date field. order_by() first: no extra GROUP BY column."""
    rows = (
        queryset.filter(**{f"{field}__gte": start, f"{field}__lte": end})
        .order_by()
        .annotate(month=TruncMonth(field))
        .values("month")
        .annotate(n=Count("id"))
    )
    return {_ym(row["month"]): row["n"] for row in rows}


def _monthly_movements(employees, date_from, date_to):
    start = _month_start(date_from)
    hires = _by_month(employees, "hire_date", start, date_to)
    departures = _by_month(employees, "departure_date", start, date_to)
    series, month = [], start
    while month <= date_to:
        key = _ym(month)
        series.append({"month": key, "hires": hires.get(key, 0), "departures": departures.get(key, 0)})
        month = _next_month(month)
    return series


def _recent_activity(user):
    queryset = AuditLog.objects.all()
    if user.role != Role.ADMIN:
        for prefix in HR_HIDDEN_ACTION_PREFIXES:
            queryset = queryset.exclude(action__startswith=prefix)
    return [
        {
            "id": entry.pk,
            "created_at": entry.created_at,
            "actor_email": entry.actor_email,
            "action": entry.action,
            "target_type": entry.target_type,
            "target_id": entry.target_id,
        }
        for entry in queryset.order_by("-created_at", "-id")[:ACTIVITY_LIMIT]  # no metadata: it may hold sensitive data
    ]


def _deadlines(contracts, today, horizon):
    items = []
    for contract in contracts.select_related("employee"):
        employee = contract.employee
        base = {
            "employee_id": employee.pk,
            "matricule": employee.matricule,
            "employee_name": f"{employee.last_name} {employee.first_name}",
            "reference": contract.reference,
        }
        if contract.end_date is not None and today <= contract.end_date <= horizon:
            items.append({"type": "CONTRACT_END", "date": contract.end_date.isoformat(), **base})
        if contract.probation_days:
            probation_end = contract.start_date + timedelta(days=contract.probation_days - 1)
            if today <= probation_end <= horizon:
                items.append({"type": "PROBATION_END", "date": probation_end.isoformat(), **base})
    items.sort(key=lambda item: (item["date"], item["matricule"]))
    return items[:DEADLINES_LIMIT]


# --- HR dashboard (ADMIN / HR) ---------------------------------------------------------------------------------


def hr_dashboard(*, user, date_from, date_to, department=None, status=None):
    today = timezone.localdate()
    alert_days = settings.CONTRACT_ALERT_DAYS
    horizon = today + timedelta(days=alert_days)
    statuses = [status] if status else [EmploymentStatus.ACTIVE, EmploymentStatus.SUSPENDED]

    employees = Employee.objects.all()
    contracts = Contract.objects.filter(status=ContractStatus.ACTIVE)
    attendance = AttendanceRecord.objects.filter(date=today)
    leaves = LeaveRequest.objects.all()
    if department is not None:
        employees = employees.filter(department=department)
        contracts = contracts.filter(employee__department=department)
        attendance = attendance.filter(employee__department=department)
        leaves = leaves.filter(employee__department=department)

    headcount = employees.filter(employment_status__in=statuses)

    # Absences of the day: recorded absences + approved leaves, each employee counted once.
    absent_ids = set(attendance.filter(status__in=ABSENT_STATUSES).values_list("employee_id", flat=True))
    on_leave_ids = set(
        leaves.filter(status=LeaveStatus.APPROVED, start_date__lte=today, end_date__gte=today)
        .values_list("employee_id", flat=True)
    )

    running_contracts = contracts.filter(
        start_date__lte=today, employee__employment_status__in=statuses
    ).filter(Q(end_date__isnull=True) | Q(end_date__gte=today))

    kpis = {
        "active_employees": employees.filter(employment_status=EmploymentStatus.ACTIVE).count(),
        "suspended_employees": employees.filter(employment_status=EmploymentStatus.SUSPENDED).count(),
        "hires_in_period": employees.filter(hire_date__range=(date_from, date_to)).count(),
        "departures_in_period": employees.filter(departure_date__range=(date_from, date_to)).count(),
        "contracts_expiring_soon": contracts.filter(end_date__gte=today, end_date__lte=horizon).count(),
        "contracts_overdue": contracts.filter(end_date__lt=today).count(),  # ended, still to be closed
        "contract_alert_days": alert_days,
        "present_today": attendance.filter(status=AttendanceStatus.PRESENT).count(),
        "absent_today": len(absent_ids | on_leave_ids),
        "on_leave_today": len(on_leave_ids),
        "pending_leave_requests": leaves.filter(status=LeaveStatus.PENDING).count(),
    }

    return {
        "generated_at": timezone.now(),
        "filters": {
            "date_from": date_from.isoformat(),
            "date_to": date_to.isoformat(),
            "department": department.pk if department else None,
            "status": status,
        },
        "kpis": kpis,
        "headcount_by_department": list(
            headcount.order_by()
            .values("department_id", code=F("department__code"), name=F("department__name"))
            .annotate(count=Count("id"))
            .order_by("-count", "name")
        ),
        "headcount_by_position": list(
            headcount.order_by()
            .values("position_id", code=F("position__code"), title=F("position__title"))
            .annotate(count=Count("id"))
            .order_by("-count", "title")
        ),
        "contracts_by_type": list(
            running_contracts.order_by()
            .values("contract_type_id", code=F("contract_type__code"), name=F("contract_type__name"))
            .annotate(count=Count("employee_id", distinct=True))
            .order_by("-count", "name")
        ),
        "monthly_movements": _monthly_movements(employees, date_from, date_to),
        "deadlines": _deadlines(contracts, today, horizon),
        "recent_activity": _recent_activity(user),
    }


# --- Employee dashboard (own data only) ----------------------------------------------------------------------------


def employee_dashboard(*, user):
    employee = Employee.objects.select_related("department", "position").filter(user=user).first()
    if employee is None:
        raise NotFound("Aucun dossier employé n'est associé à votre compte.")
    today = timezone.localdate()
    leaves = LeaveRequest.objects.filter(employee=employee)

    return {
        "employee": employee,
        "today": attendance_services.today_overview(employee),
        "leave_balances": LeaveBalance.objects.filter(employee=employee, year=today.year).select_related(
            "employee", "leave_type"
        ),
        "pending_leave_requests": leaves.filter(status=LeaveStatus.PENDING).count(),
        "next_leave": leaves.filter(status=LeaveStatus.APPROVED, end_date__gte=today)
        .select_related("employee", "employee__department", "leave_type")
        .order_by("start_date")
        .first(),
        "latest_payslip": Payslip.objects.filter(
            employee=employee, status__in=[PayslipStatus.VALIDATED, PayslipStatus.PAID]
        )
        .select_related("employee", "period")
        .order_by("-period__start_date", "-revision")
        .first(),
        "recent_leave_requests": leaves.select_related("employee", "employee__department", "leave_type").order_by(
            "-created_at"
        )[:5],
        "recent_corrections": AttendanceCorrection.objects.filter(employee=employee)
        .select_related("employee")
        .order_by("-created_at")[:5],
    }