from django.db import transaction

from . import audit


class AuditedModelMixin:
    """Create / update / delete with an audit entry written in the same transaction.

    Subclasses set `audit_created`, `audit_updated` and `audit_deleted`, and
    `audit_label_field` (the attribute identifying the object in the audit entry).
    """

    audit_created = None
    audit_updated = None
    audit_deleted = None
    audit_label_field = "code"

    def _audit_label(self, instance):
        return {self.audit_label_field: str(getattr(instance, self.audit_label_field))}

    @transaction.atomic
    def perform_create(self, serializer):
        instance = serializer.save()
        audit.record(
            action=self.audit_created,
            request=self.request,
            target=instance,
            metadata=self._audit_label(instance),
        )

    @transaction.atomic
    def perform_update(self, serializer):
        # Only field names are audited, never their values.
        changed = [
            field
            for field, value in serializer.validated_data.items()
            if getattr(serializer.instance, field) != value
        ]
        instance = serializer.save()
        if changed:
            audit.record(
                action=self.audit_updated,
                request=self.request,
                target=instance,
                metadata={**self._audit_label(instance), "fields": changed},
            )

    @transaction.atomic
    def perform_destroy(self, instance):
        # Recorded BEFORE the delete: if the delete is blocked (ProtectedError),
        # the whole transaction rolls back, audit entry included.
        audit.record(
            action=self.audit_deleted,
            request=self.request,
            target=instance,
            metadata=self._audit_label(instance),
        )
        instance.delete()