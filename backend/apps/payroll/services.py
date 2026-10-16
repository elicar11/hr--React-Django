import logging
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models import Role
from apps.contracts.models import Contract, ContractStatus
from apps.core import audit
from apps.core.models import AuditAction
from apps.employees.models import Employee

from . import engine
from .models import (
    CATEGORY_ORDER,
    EDITABLE_STATUSES,
    EmployeePayItem,
    Payment,
    PayItemCalculation,
    PayrollPeriod,
    PayrollPeriodStatus,
    PayrollSettings,
    Payslip,
    PayslipHistory,
    PayslipHistoryAction,
    PayslipLine,
    PayslipStatus,
)

logger = logging.getLogger(__name__)

CONTRACT_STATUSES_IN_PAY = [ContractStatus.ACTIVE, ContractStatus.ENDED, ContractStatus.TERMINATED]
PERCENT_CALCULATIONS = (PayItemCalculation.PERCENT_OF_BASE, PayItemCalculation.PERCENT_OF_GROSS)


# --- Helpers -------------------------------------------------------------------------------------------


def _flatten(detail):
    if isinstance(detail, dict):
        return "; ".join(_flatten(value) for value in detail.values())
    if isinstance(detail, (list, tuple)):
        return "; ".join(_flatten(value) for value in detail)
    return str(detail)


def _lock_payslip(payslip):
    return Payslip.objects.select_for_update().select_related("employee", "period").get(pk=payslip.pk)


def _lock_period(period):
    return PayrollPeriod.objects.select_for_update().get(pk=period.pk)


def _lock_employee(employee):
    return Employee.objects.select_for_update().get(pk=employee.pk)


def _history(payslip, action, actor, *, comment="", from_status="", to_status=""):
    PayslipHistory.objects.create(
        payslip=payslip, action=action, actor=actor,
        actor_email=actor.email if actor else "",
        from_status=from_status, to_status=to_status, comment=comment,
    )


def _audit(action, target, *, actor=None, request=None, **metadata):
    # Amounts are never written to the audit trail.
    audit.record(action=action, actor=actor, request=request, target=target, metadata=metadata)


def _ensure_period_open(period):
    if period.status != PayrollPeriodStatus.OPEN:
        raise ValidationError("Cette période de paie est clôturée.")


def _ensure_editable(payslip):
    _ensure_period_open(payslip.period)
    if payslip.status not in EDITABLE_STATUSES:
        raise ValidationError("Seul un bulletin brouillon ou calculé peut être modifié.")


# --- Settings ---------------------------------------------------------------------------------------------


@transaction.atomic
def update_settings(*, data, actor, request=None):
    current = PayrollSettings.objects.select_for_update().get(pk=PayrollSettings.get_solo().pk)
    if "is_demo" in data and data["is_demo"] != current.is_demo and actor.role != Role.ADMIN:
        raise PermissionDenied("Seul un administrateur peut changer le mode démonstration.")
    if (
        "currency" in data
        and data["currency"] != current.currency
        and Payslip.objects.filter(status__in=[PayslipStatus.VALIDATED, PayslipStatus.PAID]).exists()
    ):
        raise ValidationError({"currency": "La devise ne peut plus être modifiée : des bulletins validés existent."})

    changed = [field for field, value in data.items() if getattr(current, field) != value]
    for field, value in data.items():
        setattr(current, field, value)
    current.save()
    if changed:
        _audit(AuditAction.PAYROLL_SETTINGS_UPDATED, current, actor=actor, request=request, fields=changed)
    return current


# --- Employee pay elements (history of remuneration elements) --------------------------------------------------


@transaction.atomic
def create_pay_element(*, data, actor, request=None):
    employee = _lock_employee(data["employee"])
    item_type = data["item_type"]
    amount, rate = data.get("amount"), data.get("rate")
    start, end = data["start_date"], data.get("end_date")

    if not item_type.is_active:
        raise ValidationError({"item_type": "Ce type d'élément est inactif."})
    if item_type.applies_to_all or item_type.calculation in (
        PayItemCalculation.SYSTEM_BASE_SALARY, PayItemCalculation.SYSTEM_OVERTIME, PayItemCalculation.SYSTEM_UNPAID_LEAVE,
    ):
        raise ValidationError({"item_type": "Ce type est calculé automatiquement : il ne s'attribue pas à un employé."})
    if item_type.calculation == PayItemCalculation.FIXED:
        if amount is None or rate is not None:
            raise ValidationError({"amount": "Ce type est à montant fixe : renseignez `amount` (et pas `rate`)."})
    elif rate is None or amount is not None:
        raise ValidationError({"rate": "Ce type est calculé en pourcentage : renseignez `rate` (et pas `amount`)."})
    if end is not None and end < start:
        raise ValidationError({"end_date": "La date de fin doit être postérieure ou égale à la date de début."})

    overlapping = EmployeePayItem.objects.filter(employee=employee, item_type=item_type).filter(
        Q(end_date__isnull=True) | Q(end_date__gte=start)
    )
    if end is not None:
        overlapping = overlapping.filter(start_date__lte=end)
    if overlapping.exists():
        raise ValidationError(
            {"start_date": "Un élément de ce type est déjà actif sur cette période : terminez-le d'abord."}
        )

    element = EmployeePayItem.objects.create(
        employee=employee, item_type=item_type, amount=amount, rate=rate,
        start_date=start, end_date=end, created_by=actor,
    )
    _audit(
        AuditAction.PAY_ELEMENT_CREATED, element, actor=actor, request=request,
        matricule=employee.matricule, item_type=item_type.code, start_date=start.isoformat(),
    )
    return element


@transaction.atomic
def end_pay_element(*, element, end_date, actor, request=None):
    element = EmployeePayItem.objects.select_for_update().select_related("employee", "item_type").get(pk=element.pk)
    if end_date < element.start_date:
        raise ValidationError({"end_date": "La fin ne peut pas précéder le début de l'élément."})
    if element.end_date is not None and end_date > element.end_date:
        raise ValidationError({"end_date": "On ne peut que raccourcir la période d'un élément."})
    element.end_date = end_date
    element.save(update_fields=["end_date"])
    _audit(
        AuditAction.PAY_ELEMENT_ENDED, element, actor=actor, request=request,
        matricule=element.employee.matricule, item_type=element.item_type.code, end_date=end_date.isoformat(),
    )
    return element


# --- Periods -----------------------------------------------------------------------------------------------------


def _ensure_no_period_overlap(start, end, exclude_pk=None):
    overlap = (
        PayrollPeriod.objects.filter(start_date__lte=end, end_date__gte=start).exclude(pk=exclude_pk).first()
    )
    if overlap:
        raise ValidationError(
            {"start_date": f"Cette période chevauche la période {overlap.code} "
                           f"({overlap.start_date.isoformat()} → {overlap.end_date.isoformat()})."}
        )


@transaction.atomic
def create_period(*, data, actor, request=None):
    # The settings row is locked so that two simultaneous creations cannot overlap.
    PayrollSettings.objects.select_for_update().get(pk=PayrollSettings.get_solo().pk)
    _ensure_no_period_overlap(data["start_date"], data["end_date"])
    period = PayrollPeriod.objects.create(**data)
    _audit(AuditAction.PAYROLL_PERIOD_CREATED, period, actor=actor, request=request, code=period.code)
    return period


@transaction.atomic
def update_period(*, period, data, actor, request=None):
    PayrollSettings.objects.select_for_update().get(pk=PayrollSettings.get_solo().pk)
    period = _lock_period(period)
    _ensure_period_open(period)
    dates_changed = any(
        field in data and data[field] != getattr(period, field) for field in ("start_date", "end_date")
    )
    if dates_changed:
        if period.payslips.exclude(status=PayslipStatus.CANCELLED).exists():
            raise ValidationError("Des bulletins existent : les dates de la période ne peuvent plus être modifiées.")
        _ensure_no_period_overlap(
            data.get("start_date", period.start_date), data.get("end_date", period.end_date), exclude_pk=period.pk
        )
    changed = [field for field, value in data.items() if getattr(period, field) != value]
    for field, value in data.items():
        setattr(period, field, value)
    period.save()
    if changed:
        _audit(AuditAction.PAYROLL_PERIOD_UPDATED, period, actor=actor, request=request, code=period.code, fields=changed)
    return period


@transaction.atomic
def close_period(*, period, actor, request=None):
    period = _lock_period(period)
    if period.status == PayrollPeriodStatus.CLOSED:
        raise ValidationError("Cette période est déjà clôturée.")
    pending = period.payslips.filter(status__in=EDITABLE_STATUSES).count()
    if pending:
        raise ValidationError(f"{pending} bulletin(s) ne sont pas encore validés : validez ou annulez-les d'abord.")
    period.status = PayrollPeriodStatus.CLOSED
    period.closed_at = timezone.now()
    period.closed_by = actor
    period.save(update_fields=["status", "closed_at", "closed_by", "updated_at"])
    _audit(AuditAction.PAYROLL_PERIOD_CLOSED, period, actor=actor, request=request, code=period.code)
    return period


@transaction.atomic
def reopen_period(*, period, actor, request=None):
    """Controlled procedure: only an administrator can reopen a closed period."""
    if actor.role != Role.ADMIN:
        raise PermissionDenied("Seul un administrateur peut rouvrir une période clôturée.")
    period = _lock_period(period)
    if period.status != PayrollPeriodStatus.CLOSED:
        raise ValidationError("Cette période n'est pas clôturée.")
    period.status = PayrollPeriodStatus.OPEN
    period.closed_at = None
    period.closed_by = None
    period.save(update_fields=["status", "closed_at", "closed_by", "updated_at"])
    _audit(AuditAction.PAYROLL_PERIOD_REOPENED, period, actor=actor, request=request, code=period.code)
    return period


# --- Payslips ----------------------------------------------------------------------------------------------------------


@transaction.atomic
def generate_payslips(*, period, actor, request=None):
    """Create a draft payslip for each employee employed during the period (and covered by a contract)."""
    period = _lock_period(period)
    _ensure_period_open(period)
    settings = PayrollSettings.get_solo()
    if not settings.currency:
        raise ValidationError("Les paramètres de paie ne sont pas configurés (devise manquante).")

    already = Payslip.objects.filter(period=period).exclude(status=PayslipStatus.CANCELLED).values("employee_id")
    employed = (
        Employee.objects.filter(hire_date__lte=period.end_date)
        .filter(Q(departure_date__isnull=True) | Q(departure_date__gte=period.start_date))
        .exclude(pk__in=already)
    )
    with_contract = set(
        Contract.objects.filter(status__in=CONTRACT_STATUSES_IN_PAY, start_date__lte=period.end_date)
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=period.start_date))
        .values_list("employee_id", flat=True)
    )

    created, without_contract = 0, []
    for employee in employed.order_by("matricule"):
        if employee.pk not in with_contract:
            without_contract.append(employee.matricule)
            continue
        revision = Payslip.objects.filter(employee=employee, period=period).count() + 1
        payslip = Payslip.objects.create(
            employee=employee, period=period,
            reference=f"{period.code}-{employee.matricule}-R{revision}",
            revision=revision, currency=settings.currency, is_demo=settings.is_demo,
        )
        _history(payslip, PayslipHistoryAction.CREATED, actor, to_status=PayslipStatus.DRAFT)
        created += 1

    _audit(
        AuditAction.PAYSLIPS_GENERATED, period, actor=actor, request=request,
        code=period.code, created=created, without_contract=len(without_contract),
    )
    logger.info("payslips_generated actor=%s period=%s created=%s", actor.pk, period.pk, created)
    return {"created": created, "skipped_without_contract": without_contract}


def _recalculate(payslip, actor):
    """Rebuild the system and rule lines (manual lines are kept) and store totals. Payslip must be locked."""
    settings = PayrollSettings.get_solo()
    manual = list(payslip.lines.filter(is_manual=True))
    result = engine.calculate(
        employee=payslip.employee, period=payslip.period, settings=settings, manual_lines=manual
    )
    payslip.lines.filter(is_manual=False).delete()
    PayslipLine.objects.bulk_create(
        [
            PayslipLine(
                payslip=payslip,
                item_type=draft.item_type,
                code=draft.item_type.code,
                label=draft.item_type.name,
                category=draft.item_type.category,
                base_amount=draft.base_amount,
                rate=draft.rate,
                quantity=draft.quantity,
                amount=draft.amount,
                note=draft.note,
                is_manual=False,
                sort_order=CATEGORY_ORDER[draft.item_type.category],
            )
            for draft in result.lines
        ]
    )
    payslip.gross_pay, payslip.total_deductions, payslip.net_pay = result.gross, result.deductions, result.net
    payslip.currency, payslip.is_demo = settings.currency, settings.is_demo
    payslip.calculation_context = result.context
    payslip.status = PayslipStatus.CALCULATED
    payslip.calculated_at = timezone.now()
    payslip.calculated_by = actor
    payslip.save()


@transaction.atomic
def calculate_payslip(*, payslip, actor, request=None):
    payslip = _lock_payslip(payslip)
    _ensure_editable(payslip)
    previous = payslip.status
    _recalculate(payslip, actor)
    _history(
        payslip, PayslipHistoryAction.CALCULATED, actor, from_status=previous, to_status=PayslipStatus.CALCULATED
    )
    _audit(AuditAction.PAYSLIP_CALCULATED, payslip, actor=actor, request=request, reference=payslip.reference)
    return payslip


def calculate_period(*, period, actor, request=None):
    """Calculate every draft / calculated payslip of the period. A failure only affects its own payslip."""
    calculated, errors = 0, []
    payslips = Payslip.objects.filter(period=period, status__in=EDITABLE_STATUSES).select_related("employee")
    for payslip in payslips.order_by("employee__matricule"):
        try:
            calculate_payslip(payslip=payslip, actor=actor, request=request)
            calculated += 1
        except ValidationError as exc:
            errors.append({"reference": payslip.reference, "matricule": payslip.employee.matricule, "detail": _flatten(exc.detail)})
    return {"calculated": calculated, "errors": errors}


@transaction.atomic
def add_manual_line(*, payslip, item_type, amount, note, actor, request=None):
    """One-off element (bonus, deduction...) added by HR; kept at each recalculation."""
    payslip = _lock_payslip(payslip)
    _ensure_editable(payslip)
    if not item_type.is_active:
        raise ValidationError({"item_type": "Ce type d'élément est inactif."})
    if item_type.calculation != PayItemCalculation.FIXED or item_type.applies_to_all:
        raise ValidationError(
            {"item_type": "Seul un type à montant fixe, non appliqué automatiquement, peut être saisi manuellement."}
        )
    if amount <= 0:
        raise ValidationError({"amount": "Le montant doit être strictement positif."})

    line = PayslipLine.objects.create(
        payslip=payslip, item_type=item_type, code=item_type.code, label=item_type.name,
        category=item_type.category, amount=engine.money(amount), note=note, is_manual=True,
        sort_order=CATEGORY_ORDER[item_type.category],
    )
    _recalculate(payslip, actor)
    _history(
        payslip, PayslipHistoryAction.LINE_ADDED, actor,
        comment=f"{item_type.code}", from_status=payslip.status, to_status=payslip.status,
    )
    _audit(AuditAction.PAYSLIP_LINE_ADDED, payslip, actor=actor, request=request, reference=payslip.reference, item_type=item_type.code)
    return line


@transaction.atomic
def remove_manual_line(*, payslip, line, actor, request=None):
    payslip = _lock_payslip(payslip)
    _ensure_editable(payslip)
    if not line.is_manual or line.payslip_id != payslip.pk:
        raise ValidationError("Seules les lignes saisies manuellement peuvent être retirées.")
    code = line.code
    PayslipLine.objects.filter(pk=line.pk).delete()
    _recalculate(payslip, actor)
    _history(
        payslip, PayslipHistoryAction.LINE_REMOVED, actor,
        comment=code, from_status=payslip.status, to_status=payslip.status,
    )
    _audit(AuditAction.PAYSLIP_LINE_REMOVED, payslip, actor=actor, request=request, reference=payslip.reference, item_type=code)
    return payslip


@transaction.atomic
def validate_payslip(*, payslip, comment, actor, request=None):
    payslip = _lock_payslip(payslip)
    _ensure_period_open(payslip.period)
    if payslip.status != PayslipStatus.CALCULATED:
        raise ValidationError("Seul un bulletin calculé peut être validé.")
    if payslip.employee.user_id == actor.pk:
        raise ValidationError("Vous ne pouvez pas valider votre propre bulletin.")

    # Freshness check: replay the calculation and compare, so a stale payslip is never frozen.
    settings = PayrollSettings.get_solo()
    result = engine.calculate(
        employee=payslip.employee, period=payslip.period, settings=settings,
        manual_lines=list(payslip.lines.filter(is_manual=True)),
    )
    if (
        (result.gross, result.deductions, result.net)
        != (payslip.gross_pay, payslip.total_deductions, payslip.net_pay)
        or settings.currency != payslip.currency
        or settings.is_demo != payslip.is_demo
    ):
        raise ValidationError(
            "Les données ont changé depuis le calcul : recalculez le bulletin avant de le valider."
        )

    payslip.status = PayslipStatus.VALIDATED
    payslip.validated_at = timezone.now()
    payslip.validated_by = actor
    payslip.save(update_fields=["status", "validated_at", "validated_by", "updated_at"])
    _history(
        payslip, PayslipHistoryAction.VALIDATED, actor,
        comment=comment, from_status=PayslipStatus.CALCULATED, to_status=PayslipStatus.VALIDATED,
    )
    _audit(AuditAction.PAYSLIP_VALIDATED, payslip, actor=actor, request=request, reference=payslip.reference)
    logger.info("payslip_validated actor=%s payslip=%s", actor.pk, payslip.pk)
    return payslip


def validate_period(*, period, comment, actor, request=None):
    """Validate every calculated payslip of the period. A failure only affects its own payslip."""
    validated, errors = 0, []
    payslips = Payslip.objects.filter(period=period, status=PayslipStatus.CALCULATED).select_related("employee")
    for payslip in payslips.order_by("employee__matricule"):
        try:
            validate_payslip(payslip=payslip, comment=comment, actor=actor, request=request)
            validated += 1
        except (ValidationError, PermissionDenied) as exc:
            errors.append({"reference": payslip.reference, "matricule": payslip.employee.matricule, "detail": _flatten(exc.detail)})
    return {"validated": validated, "errors": errors}


@transaction.atomic
def pay_payslip(*, payslip, method, payment_date, reference, actor, request=None):
    payslip = _lock_payslip(payslip)
    if payslip.status != PayslipStatus.VALIDATED:
        raise ValidationError("Seul un bulletin validé peut être payé.")
    if payslip.employee.user_id == actor.pk:
        raise ValidationError("Vous ne pouvez pas enregistrer le paiement de votre propre bulletin.")
    if payment_date > timezone.localdate():
        raise ValidationError({"payment_date": "La date de paiement ne peut pas être dans le futur."})
    if payment_date < payslip.period.start_date:
        raise ValidationError({"payment_date": "La date de paiement précède la période de paie."})

    Payment.objects.create(
        payslip=payslip, amount=payslip.net_pay, method=method,
        payment_date=payment_date, reference=reference, recorded_by=actor,
    )
    payslip.status = PayslipStatus.PAID
    payslip.save(update_fields=["status", "updated_at"])
    _history(
        payslip, PayslipHistoryAction.PAID, actor,
        from_status=PayslipStatus.VALIDATED, to_status=PayslipStatus.PAID,
    )
    _audit(AuditAction.PAYSLIP_PAID, payslip, actor=actor, request=request, reference=payslip.reference, method=method)
    return payslip


@transaction.atomic
def cancel_payslip(*, payslip, reason, actor, request=None):
    """Controlled cancellation. A validated payslip needs an administrator; a paid one cannot be cancelled."""
    payslip = _lock_payslip(payslip)
    _ensure_period_open(payslip.period)
    if payslip.status == PayslipStatus.PAID:
        raise ValidationError(
            "Un bulletin payé ne peut pas être annulé : régularisez par un élément dans une période ultérieure."
        )
    if payslip.status == PayslipStatus.CANCELLED:
        raise ValidationError("Ce bulletin est déjà annulé.")
    if payslip.status == PayslipStatus.VALIDATED and actor.role != Role.ADMIN:
        raise PermissionDenied("Seul un administrateur peut annuler un bulletin validé.")

    previous = payslip.status
    payslip.status = PayslipStatus.CANCELLED
    payslip.cancelled_at = timezone.now()
    payslip.cancelled_by = actor
    payslip.cancel_reason = reason
    payslip.save(update_fields=["status", "cancelled_at", "cancelled_by", "cancel_reason", "updated_at"])
    _history(
        payslip, PayslipHistoryAction.CANCELLED, actor,
        comment=reason, from_status=previous, to_status=PayslipStatus.CANCELLED,
    )
    _audit(AuditAction.PAYSLIP_CANCELLED, payslip, actor=actor, request=request, reference=payslip.reference, was=previous)
    logger.info("payslip_cancelled actor=%s payslip=%s", actor.pk, payslip.pk)
    return payslip