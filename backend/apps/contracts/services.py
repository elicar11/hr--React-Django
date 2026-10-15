import logging
from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.core import audit
from apps.core.models import AuditAction
from apps.employees.models import Employee, EmploymentStatus

from .models import Contract, ContractDocument, ContractStatus

logger = logging.getLogger(__name__)

DAY = timedelta(days=1)


def _lock_employee(employee):
    """Row lock: contract changes of one employee are serialized (overlap checks stay reliable)."""
    return Employee.objects.select_for_update().get(pk=employee.pk)


def _lock_contract(contract):
    return Contract.objects.select_for_update().get(pk=contract.pk)


def _audit(action, contract, *, actor=None, request=None, **metadata):
    audit.record(
        action=action,
        actor=actor,
        request=request,
        target=contract,
        metadata={"reference": contract.reference, **metadata},
    )


# --- Business rules ----------------------------------------------------------


def _overlapping(employee, start_date, end_date, exclude_pks=()):
    """Signed contracts (not drafts) of the employee overlapping [start_date, end_date]."""
    queryset = (
        Contract.objects.filter(employee=employee)
        .exclude(status=ContractStatus.DRAFT)
        .exclude(pk__in=exclude_pks)
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=start_date))
    )
    if end_date is not None:
        queryset = queryset.filter(start_date__lte=end_date)
    return queryset


def validate_terms(*, employee, contract_type, position, start_date, end_date, probation_days, exclude_pks=()):
    """Chronological and consistency rules shared by creation, update, renewal and activation."""
    if employee.employment_status == EmploymentStatus.TERMINATED:
        raise ValidationError({"employee": "Cet employé est sorti : aucun contrat n'est possible."})

    errors = {}
    if not contract_type.is_active:
        errors["contract_type"] = "Ce type de contrat est inactif."
    if not position.is_active:
        errors["position"] = "Le poste doit être actif."
    if start_date < employee.hire_date:
        errors["start_date"] = "Le contrat ne peut pas commencer avant la date d'embauche."
    if contract_type.is_fixed_term and end_date is None:
        errors["end_date"] = "La date de fin est obligatoire pour un contrat à durée déterminée."
    if not contract_type.is_fixed_term and end_date is not None:
        errors["end_date"] = "Un contrat à durée indéterminée n'a pas de date de fin."
    if end_date is not None and end_date < start_date:
        errors["end_date"] = "La date de fin doit être postérieure ou égale à la date de début."
    if probation_days and end_date is not None and end_date >= start_date:
        if probation_days > (end_date - start_date).days + 1:
            errors["probation_days"] = "La période d'essai dépasse la durée du contrat."
    if errors:
        raise ValidationError(errors)

    conflict = _overlapping(employee, start_date, end_date, exclude_pks).first()
    if conflict:
        raise ValidationError({"start_date": f"Cette période chevauche le contrat {conflict.reference}."})


def _check_renewal_window(source, start_date):
    """A renewal starts after the source began, and follows it without interruption."""
    if start_date <= source.start_date:
        raise ValidationError(
            {"start_date": "Le renouvellement doit commencer après le début du contrat renouvelé."}
        )
    if source.end_date is not None and start_date > source.end_date + DAY:
        limit = (source.end_date + DAY).isoformat()
        raise ValidationError(
            {"start_date": f"Un renouvellement doit suivre le contrat sans interruption (au plus tard le {limit})."}
        )


# --- Create / update / delete (drafts) ------------------------------------------


@transaction.atomic
def create_contract(*, data, actor, request=None):
    employee = _lock_employee(data["employee"])
    validate_terms(
        employee=employee,
        contract_type=data["contract_type"],
        position=data["position"],
        start_date=data["start_date"],
        end_date=data.get("end_date"),
        probation_days=data.get("probation_days"),
    )
    contract = Contract.objects.create(**{**data, "employee": employee})
    _audit(AuditAction.CONTRACT_CREATED, contract, actor=actor, request=request)
    logger.info("contract_created actor=%s contract=%s", actor.pk, contract.pk)
    return contract


@transaction.atomic
def update_contract(*, contract, data, actor, request=None):
    contract = _lock_contract(contract)
    if contract.status != ContractStatus.DRAFT:
        raise ValidationError(
            "Seul un contrat en brouillon peut être modifié. Pour changer les conditions d'un "
            "contrat en cours, créez un contrat de renouvellement."
        )
    data = {k: v for k, v in data.items() if k != "employee"}  # the employee never changes
    employee = _lock_employee(contract.employee)
    terms = {
        field: data.get(field, getattr(contract, field))
        for field in ("contract_type", "position", "start_date", "end_date", "probation_days")
    }
    exclude = [contract.renews_id] if contract.renews_id else []
    validate_terms(employee=employee, exclude_pks=exclude, **terms)
    if contract.renews_id:
        _check_renewal_window(contract.renews, terms["start_date"])

    # Only field names are audited, never their values (salary included).
    changed = [field for field, value in data.items() if getattr(contract, field) != value]
    for field, value in data.items():
        setattr(contract, field, value)
    contract.save()
    if changed:
        _audit(AuditAction.CONTRACT_UPDATED, contract, actor=actor, request=request, fields=changed)
    return contract


@transaction.atomic
def delete_contract(*, contract, actor, request=None):
    """Only drafts can be deleted: a signed contract stays in the history."""
    contract = _lock_contract(contract)
    if contract.status != ContractStatus.DRAFT:
        raise ValidationError("Seul un brouillon peut être supprimé : un contrat signé est conservé.")
    # Recorded before the delete, in the same transaction.
    _audit(AuditAction.CONTRACT_DELETED, contract, actor=actor, request=request)
    for document in contract.documents.all():
        transaction.on_commit(lambda s=document.file.storage, n=document.file.name: s.delete(n))
    contract.delete()


# --- Lifecycle -------------------------------------------------------------------


@transaction.atomic
def activate(*, contract, signed_date, actor, request=None):
    """Sign a draft. If it renews a contract, that contract is closed the day before."""
    contract = _lock_contract(contract)
    employee = _lock_employee(contract.employee)
    if contract.status != ContractStatus.DRAFT:
        raise ValidationError("Seul un brouillon peut être activé.")
    today = timezone.localdate()
    if signed_date > today:
        raise ValidationError({"signed_date": "La date de signature ne peut pas être dans le futur."})

    predecessor = _lock_contract(contract.renews) if contract.renews_id else None
    validate_terms(
        employee=employee,
        contract_type=contract.contract_type,
        position=contract.position,
        start_date=contract.start_date,
        end_date=contract.end_date,
        probation_days=contract.probation_days,
        exclude_pks=[predecessor.pk] if predecessor else [],
    )

    if predecessor:
        if predecessor.status not in (ContractStatus.ACTIVE, ContractStatus.ENDED):
            raise ValidationError("Le contrat à renouveler n'est plus en cours.")
        _check_renewal_window(predecessor, contract.start_date)
        # The predecessor's terms stay untouched: only its end is brought to the day before.
        if predecessor.end_date is None or predecessor.end_date >= contract.start_date:
            predecessor.end_date = contract.start_date - DAY
        if predecessor.end_date < today:
            predecessor.status = ContractStatus.ENDED
        predecessor.save(update_fields=["end_date", "status", "updated_at"])
        _audit(
            AuditAction.CONTRACT_ENDED, predecessor, actor=actor, request=request,
            reason="renewed", renewed_by=contract.reference,
        )

    contract.status = ContractStatus.ACTIVE
    contract.signed_date = signed_date
    contract.save(update_fields=["status", "signed_date", "updated_at"])
    _audit(AuditAction.CONTRACT_ACTIVATED, contract, actor=actor, request=request)
    logger.info("contract_activated actor=%s contract=%s", actor.pk, contract.pk)
    return contract


@transaction.atomic
def renew(*, contract, data, actor, request=None):
    """Create the draft successor of a running contract; the source is left untouched."""
    source = _lock_contract(contract)
    employee = _lock_employee(source.employee)
    if source.status != ContractStatus.ACTIVE:
        raise ValidationError("Seul un contrat en cours peut être renouvelé.")
    if Contract.objects.filter(renews=source).exists():
        raise ValidationError("Ce contrat a déjà un contrat de renouvellement.")
    _check_renewal_window(source, data["start_date"])

    terms = {
        "contract_type": data.get("contract_type", source.contract_type),
        "position": data.get("position", source.position),
        "base_salary": data.get("base_salary", source.base_salary),
        "currency": data.get("currency", source.currency),
        "start_date": data["start_date"],
        "end_date": data.get("end_date"),
        "probation_days": data.get("probation_days"),
    }
    validate_terms(
        employee=employee,
        contract_type=terms["contract_type"],
        position=terms["position"],
        start_date=terms["start_date"],
        end_date=terms["end_date"],
        probation_days=terms["probation_days"],
        exclude_pks=[source.pk],
    )
    successor = Contract.objects.create(
        employee=employee, reference=data["reference"], renews=source, **terms
    )
    _audit(AuditAction.CONTRACT_RENEWED, successor, actor=actor, request=request, renews=source.reference)
    return successor


@transaction.atomic
def terminate(*, contract, end_date, actor, request=None):
    """Early termination of a running contract."""
    contract = _lock_contract(contract)
    if contract.status != ContractStatus.ACTIVE:
        raise ValidationError("Seul un contrat en cours peut être rompu.")
    if end_date < contract.start_date:
        raise ValidationError({"end_date": "La date de fin ne peut pas précéder le début du contrat."})
    if contract.end_date is not None and end_date > contract.end_date:
        raise ValidationError({"end_date": "La rupture doit avoir lieu avant la fin prévue du contrat."})
    if Contract.objects.filter(renews=contract).exclude(status=ContractStatus.DRAFT).exists():
        raise ValidationError("Ce contrat a été renouvelé : il ne peut plus être rompu.")

    contract.end_date = end_date
    contract.status = ContractStatus.TERMINATED
    contract.save(update_fields=["end_date", "status", "updated_at"])
    _audit(AuditAction.CONTRACT_TERMINATED, contract, actor=actor, request=request)
    return contract


def close_contracts_for_departure(*, employee, departure_date, actor, request=None):
    """Called when an employee leaves: running contracts end with the employment."""
    running = Contract.objects.select_for_update().filter(employee=employee, status=ContractStatus.ACTIVE)
    for contract in running:
        if contract.start_date > departure_date:
            raise ValidationError(
                {"departure_date": f"Le contrat {contract.reference} débute après cette date de départ."}
            )
        if contract.end_date is None or contract.end_date > departure_date:
            contract.end_date = departure_date
            contract.status = ContractStatus.TERMINATED
            action = AuditAction.CONTRACT_TERMINATED
        else:
            contract.status = ContractStatus.ENDED
            action = AuditAction.CONTRACT_ENDED
        contract.save(update_fields=["end_date", "status", "updated_at"])
        _audit(action, contract, actor=actor, request=request, reason="employee_departure")


def close_expired_contracts(*, today=None):
    """Mark ACTIVE contracts whose end date has passed as ENDED. Meant to run daily."""
    today = today or timezone.localdate()
    count = 0
    for pk in list(
        Contract.objects.filter(status=ContractStatus.ACTIVE, end_date__lt=today).values_list("pk", flat=True)
    ):
        with transaction.atomic():
            contract = Contract.objects.select_for_update().get(pk=pk)
            if contract.status != ContractStatus.ACTIVE:
                continue
            contract.status = ContractStatus.ENDED
            contract.save(update_fields=["status", "updated_at"])
            _audit(AuditAction.CONTRACT_ENDED, contract, reason="expired", source="system")
            count += 1
    logger.info("expired_contracts_closed count=%s", count)
    return count


# --- Documents -------------------------------------------------------------------


@transaction.atomic
def add_document(*, contract, title, file, actor, request=None):
    document = ContractDocument.objects.create(
        contract=contract, title=title, file=file, uploaded_by=actor
    )
    _audit(AuditAction.CONTRACT_DOCUMENT_ADDED, contract, actor=actor, request=request, document_id=document.pk)
    return document


@transaction.atomic
def remove_document(*, document, actor, request=None):
    contract = document.contract
    document_id = document.pk
    storage, name = document.file.storage, document.file.name
    document.delete()
    transaction.on_commit(lambda: storage.delete(name))  # file removed once the DB change is committed
    _audit(AuditAction.CONTRACT_DOCUMENT_REMOVED, contract, actor=actor, request=request, document_id=document_id)