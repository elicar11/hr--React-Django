from django.conf import settings
from django.db import models


class AuditAction:
    """Audit action identifiers (plain strings: new modules add theirs without a migration)."""

    LOGIN = "auth.login"
    LOGIN_FAILED = "auth.login_failed"
    LOGOUT = "auth.logout"
    PASSWORD_CHANGED = "auth.password_changed"
    PASSWORD_RESET_REQUESTED = "auth.password_reset_requested"
    PASSWORD_RESET_COMPLETED = "auth.password_reset_completed"

    USER_CREATED = "user.created"
    USER_UPDATED = "user.updated"
    USER_ACTIVATED = "user.activated"
    USER_DEACTIVATED = "user.deactivated"

    DEPARTMENT_CREATED = "department.created"
    DEPARTMENT_UPDATED = "department.updated"
    DEPARTMENT_DELETED = "department.deleted"
    DEPARTMENT_ACTIVATED = "department.activated"
    DEPARTMENT_DEACTIVATED = "department.deactivated"

    POSITION_CREATED = "position.created"
    POSITION_UPDATED = "position.updated"
    POSITION_DELETED = "position.deleted"
    POSITION_ACTIVATED = "position.activated"
    POSITION_DEACTIVATED = "position.deactivated"
    
    EMPLOYEE_CREATED = "employee.created"
    EMPLOYEE_UPDATED = "employee.updated"
    EMPLOYEE_ASSIGNED = "employee.assigned"
    EMPLOYEE_SUSPENDED = "employee.suspended"
    EMPLOYEE_TERMINATED = "employee.terminated"
    EMPLOYEE_REACTIVATED = "employee.reactivated"
    EMPLOYEE_PHOTO_UPDATED = "employee.photo_updated"
    EMPLOYEE_PHOTO_REMOVED = "employee.photo_removed"


class AuditLog(models.Model):
    """Append-only trail of security-relevant and administrative operations.

    Never store passwords, tokens or sensitive personal data in `metadata`.
    """

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    # Snapshot kept even if the account is later removed or renamed.
    actor_email = models.CharField(max_length=254, blank=True)
    action = models.CharField(max_length=64, db_index=True)
    target_type = models.CharField(max_length=100, blank=True)
    target_id = models.CharField(max_length=64, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        verbose_name = "entrée du journal d'audit"
        verbose_name_plural = "journal d'audit"
        indexes = [models.Index(fields=["target_type", "target_id"])]

    def __str__(self):
        return f"{self.created_at:%Y-%m-%d %H:%M:%S} {self.action} ({self.actor_email or 'anonyme'})"

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValueError("Les entrées du journal d'audit sont immuables.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError("Les entrées du journal d'audit ne peuvent pas être supprimées.")