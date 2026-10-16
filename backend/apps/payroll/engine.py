from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Q, Sum
from rest_framework.exceptions import ValidationError

from apps.attendance import services as attendance_services
from apps.attendance.models import AttendanceRecord, AttendanceStatus
from apps.contracts.models import Contract, ContractStatus
from apps.leaves.models import LeaveRequest, LeaveStatus

from .models import (
    ADJUSTMENT_CATEGORIES,
    DEDUCTION_CATEGORIES,
    EARNING_CATEGORIES,
    EmployeePayItem,
    PayItemCalculation,
    PayItemType,
)

CENT = Decimal("0.01")
HUNDRED = Decimal("100")
SYSTEM_LABELS = {
    PayItemCalculation.SYSTEM_BASE_SALARY: "salaire de base",
    PayItemCalculation.SYSTEM_OVERTIME: "heures supplémentaires",
    PayItemCalculation.SYSTEM_UNPAID_LEAVE: "congé sans solde",
}


def money(value):
    """Monetary rounding: 2 decimals, half up. Never floats."""
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


@dataclass
class LineDraft:
    item_type: PayItemType
    amount: Decimal
    base_amount: Decimal | None = None
    rate: Decimal | None = None
    quantity: Decimal | None = None
    note: str = ""


@dataclass
class Calculation:
    lines: list
    gross: Decimal
    deductions: Decimal
    net: Decimal
    context: dict


def _system_type(calculation):
    item_type = PayItemType.objects.filter(calculation=calculation, is_active=True).first()
    if item_type is None:
        raise ValidationError(
            f"Type d'élément système manquant ou inactif : {SYSTEM_LABELS[calculation]} "
            "(voir la commande seed_demo_payroll ou créez-le)."
        )
    return item_type


def _base_salary_lines(employee, period, settings, working_days):
    contracts = list(
        Contract.objects.filter(
            employee=employee,
            status__in=[ContractStatus.ACTIVE, ContractStatus.ENDED, ContractStatus.TERMINATED],
            start_date__lte=period.end_date,
        )
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=period.start_date))
        .order_by("start_date")
    )
    if not contracts:
        raise ValidationError("Aucun contrat applicable sur cette période.")

    item_type = _system_type(PayItemCalculation.SYSTEM_BASE_SALARY)
    lines = []
    for contract in contracts:
        if contract.currency != settings.currency:
            raise ValidationError(
                f"Le contrat {contract.reference} est en {contract.currency} : la paie est en {settings.currency}."
            )
        covered_start = max(period.start_date, contract.start_date)
        covered_end = min(period.end_date, contract.end_date or period.end_date)
        if covered_start == period.start_date and covered_end == period.end_date:
            fraction, note = Decimal(1), f"Contrat {contract.reference}"
        else:
            if not settings.prorate_partial_periods:
                raise ValidationError(
                    f"Le contrat {contract.reference} ne couvre pas toute la période (prorata désactivé)."
                )
            covered = sum(1 for d in working_days if covered_start <= d <= covered_end)
            total = len(working_days)
            fraction = Decimal(covered) / Decimal(total) if total else Decimal(0)
            note = f"Contrat {contract.reference} - prorata {covered}/{total} jours ouvrés"
        lines.append(
            LineDraft(
                item_type=item_type,
                amount=money(contract.base_salary * fraction),
                base_amount=money(contract.base_salary),
                note=note,
            )
        )
    return lines, contracts


def _overtime_line(employee, period, settings, reference_base):
    minutes = (
        AttendanceRecord.objects.filter(
            employee=employee, status=AttendanceStatus.PRESENT,
            date__range=(period.start_date, period.end_date),
        ).aggregate(total=Sum("overtime_minutes"))["total"]
        or 0
    )
    if minutes == 0:
        return None, 0
    if settings.monthly_hours is None or settings.overtime_multiplier is None:
        raise ValidationError(
            "Paramètres de paie manquants : heures mensuelles et majoration des heures supplémentaires."
        )
    hours = (Decimal(minutes) / Decimal(60)).quantize(CENT, rounding=ROUND_HALF_UP)
    hourly = reference_base / settings.monthly_hours
    return (
        LineDraft(
            item_type=_system_type(PayItemCalculation.SYSTEM_OVERTIME),
            amount=money(hours * hourly * settings.overtime_multiplier),
            base_amount=money(hourly),
            quantity=hours,
            note=f"Taux horaire x {settings.overtime_multiplier}",
        ),
        minutes,
    )


def _unpaid_leave_line(employee, period, base_total, working_days):
    leaves = LeaveRequest.objects.filter(
        employee=employee, status=LeaveStatus.APPROVED, leave_type__is_paid=False,
        start_date__lte=period.end_date, end_date__gte=period.start_date,
    )
    unpaid = set()
    for leave in leaves:
        start, end = max(period.start_date, leave.start_date), min(period.end_date, leave.end_date)
        unpaid.update(day for day in working_days if start <= day <= end)
    if not unpaid or not working_days:
        return None, 0
    amount = money(base_total * Decimal(len(unpaid)) / Decimal(len(working_days)))
    return (
        LineDraft(
            item_type=_system_type(PayItemCalculation.SYSTEM_UNPAID_LEAVE),
            amount=amount,
            base_amount=money(base_total),
            quantity=Decimal(len(unpaid)),
            note=f"{len(unpaid)}/{len(working_days)} jours ouvrés non rémunérés",
        ),
        len(unpaid),
    )


def _rules(employee, period):
    """(item_type, amount, rate): company-wide types first, then the employee's own active elements."""
    rules = [
        (item_type, item_type.default_amount, item_type.default_rate)
        for item_type in PayItemType.objects.filter(is_active=True, applies_to_all=True).order_by("code")
    ]
    elements = (
        EmployeePayItem.objects.select_related("item_type")
        .filter(employee=employee, item_type__is_active=True, start_date__lte=period.end_date)
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=period.start_date))
        .order_by("item_type__code")
    )
    rules.extend((element.item_type, element.amount, element.rate) for element in elements)
    return rules


def _evaluate(item_type, amount, rate, base_total, gross):
    calculation = item_type.calculation
    if calculation == PayItemCalculation.FIXED:
        if amount is None:
            raise ValidationError(f"Montant manquant pour « {item_type.name} ».")
        return LineDraft(item_type=item_type, amount=money(amount))
    if rate is None:
        raise ValidationError(f"Taux manquant pour « {item_type.name} ».")
    if calculation == PayItemCalculation.PERCENT_OF_BASE:
        basis = base_total
    elif calculation == PayItemCalculation.PERCENT_OF_GROSS:
        if gross is None:
            raise ValidationError(f"« {item_type.name} » : un pourcentage du brut ne peut pas s'appliquer à un gain.")
        basis = gross
    else:
        raise ValidationError(f"Calcul non applicable pour « {item_type.name} ».")
    return LineDraft(
        item_type=item_type, amount=money(basis * rate / HUNDRED), base_amount=money(basis), rate=rate
    )


def calculate(*, employee, period, settings, manual_lines=()):
    """Compute the system and rule lines, plus the totals (manual lines included).

    Read-only: nothing is written. `manual_lines` are existing PayslipLine objects (is_manual).
    """
    if not settings.currency:
        raise ValidationError("Les paramètres de paie ne sont pas configurés (devise manquante).")

    working_days = attendance_services.scheduled_working_days(employee, period.start_date, period.end_date)
    lines, contracts = _base_salary_lines(employee, period, settings, working_days)
    base_total = sum((line.amount for line in lines), Decimal(0))
    reference_base = contracts[-1].base_salary  # base of the latest contract of the period

    overtime, overtime_minutes = _overtime_line(employee, period, settings, reference_base)
    unpaid, unpaid_days = _unpaid_leave_line(employee, period, base_total, working_days)
    lines.extend(line for line in (overtime, unpaid) if line is not None)

    # Phase 1: gains and gross adjustments (a percentage of the gross is not allowed here).
    deduction_rules = []
    for item_type, amount, rate in _rules(employee, period):
        if item_type.category in DEDUCTION_CATEGORIES:
            deduction_rules.append((item_type, amount, rate))
        else:
            lines.append(_evaluate(item_type, amount, rate, base_total, gross=None))

    earnings = adjustments = Decimal(0)
    for line in lines:
        category = line.item_type.category
        if category in EARNING_CATEGORIES:
            earnings += line.amount
        elif category in ADJUSTMENT_CATEGORIES:
            adjustments += line.amount
    for manual in manual_lines:
        if manual.category in EARNING_CATEGORIES:
            earnings += manual.amount
        elif manual.category in ADJUSTMENT_CATEGORIES:
            adjustments += manual.amount

    gross = money(earnings - adjustments)
    if gross < 0:
        raise ValidationError("Le brut est négatif : vérifiez les retenues sur absence.")

    # Phase 2: deductions, on the base or on the gross.
    deductions = Decimal(0)
    for item_type, amount, rate in deduction_rules:
        line = _evaluate(item_type, amount, rate, base_total, gross)
        lines.append(line)
        deductions += line.amount
    deductions += sum((m.amount for m in manual_lines if m.category in DEDUCTION_CATEGORIES), Decimal(0))
    deductions = money(deductions)

    net = money(gross - deductions)
    if net < 0:
        raise ValidationError("Le net à payer est négatif : les retenues dépassent le brut.")

    context = {
        "settings": {
            "currency": settings.currency,
            "is_demo": settings.is_demo,
            "monthly_hours": str(settings.monthly_hours) if settings.monthly_hours is not None else None,
            "overtime_multiplier": str(settings.overtime_multiplier) if settings.overtime_multiplier is not None else None,
            "prorate_partial_periods": settings.prorate_partial_periods,
        },
        "contracts": [contract.reference for contract in contracts],
        "working_days_in_period": len(working_days),
        "overtime_minutes": overtime_minutes,
        "unpaid_leave_days": unpaid_days,
    }
    return Calculation(lines=lines, gross=gross, deductions=deductions, net=net, context=context)