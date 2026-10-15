import logging

from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.core import audit
from apps.core.models import AuditAction

from .models import Department

logger = logging.getLogger(__name__)


def would_create_cycle(department, new_parent):
    """True if making `new_parent` the parent of `department` creates a loop."""
    node = new_parent
    while node is not None:
        if node.pk == department.pk:
            return True
        node = node.parent
    return False


@transaction.atomic
def set_department_active(*, actor, department, is_active, request=None):
    if is_active:
        if department.parent and not department.parent.is_active:
            raise ValidationError("Activez d'abord le département parent.")
    elif department.children.filter(is_active=True).exists():
        raise ValidationError("Désactivez d'abord les sous-départements actifs.")

    department.is_active = is_active
    department.save(update_fields=["is_active", "updated_at"])
    audit.record(
        action=AuditAction.DEPARTMENT_ACTIVATED if is_active else AuditAction.DEPARTMENT_DEACTIVATED,
        actor=actor,
        request=request,
        target=department,
        metadata={"code": department.code},
    )
    logger.info("department_active_changed actor=%s target=%s is_active=%s", actor.pk, department.pk, is_active)
    return department


@transaction.atomic
def set_position_active(*, actor, position, is_active, request=None):
    if is_active and position.department and not position.department.is_active:
        raise ValidationError("Activez d'abord le département associé à ce poste.")

    position.is_active = is_active
    position.save(update_fields=["is_active", "updated_at"])
    audit.record(
        action=AuditAction.POSITION_ACTIVATED if is_active else AuditAction.POSITION_DEACTIVATED,
        actor=actor,
        request=request,
        target=position,
        metadata={"code": position.code},
    )
    logger.info("position_active_changed actor=%s target=%s is_active=%s", actor.pk, position.pk, is_active)
    return position


def build_department_tree(*, include_inactive=False):
    """Nested department hierarchy built from a single query."""
    queryset = Department.objects.order_by("code")
    if not include_inactive:
        queryset = queryset.filter(is_active=True)

    departments = list(queryset)
    nodes = {
        d.pk: {"id": d.pk, "code": d.code, "name": d.name, "is_active": d.is_active, "children": []}
        for d in departments
    }
    roots = []
    for department in departments:
        parent_node = nodes.get(department.parent_id)
        # A missing parent (filtered out) makes the node a root, never a lost node.
        (parent_node["children"] if parent_node else roots).append(nodes[department.pk])
    return roots