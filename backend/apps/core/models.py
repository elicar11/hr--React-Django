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
    
    CONTRACT_TYPE_CREATED = "contract_type.created"
    CONTRACT_TYPE_UPDATED = "contract_type.updated"
    CONTRACT_TYPE_DELETED = "contract_type.deleted"

    CONTRACT_CREATED = "contract.created"
    CONTRACT_UPDATED = "contract.updated"
    CONTRACT_DELETED = "contract.deleted"
    CONTRACT_ACTIVATED = "contract.activated"
    CONTRACT_RENEWED = "contract.renewed"
    CONTRACT_TERMINATED = "contract.terminated"
    CONTRACT_ENDED = "contract.ended"
    CONTRACT_DOCUMENT_ADDED = "contract.document_added"
    CONTRACT_DOCUMENT_REMOVED = "contract.document_removed"
    
    WORK_SCHEDULE_CREATED = "work_schedule.created"
    WORK_SCHEDULE_UPDATED = "work_schedule.updated"
    WORK_SCHEDULE_DELETED = "work_schedule.deleted"
    WORK_SCHEDULE_DEFAULT_SET = "work_schedule.default_set"
    SCHEDULE_ASSIGNED = "schedule.assigned"

    HOLIDAY_CREATED = "holiday.created"
    HOLIDAY_UPDATED = "holiday.updated"
    HOLIDAY_DELETED = "holiday.deleted"

    ATTENDANCE_CHECKED_IN = "attendance.checked_in"
    ATTENDANCE_CHECKED_OUT = "attendance.checked_out"
    ATTENDANCE_RECORD_CREATED = "attendance.record_created"
    ATTENDANCE_RECORD_UPDATED = "attendance.record_updated"
    ATTENDANCE_RECORD_DELETED = "attendance.record_deleted"
    ATTENDANCE_ABSENCES_MARKED = "attendance.absences_marked"
    ATTENDANCE_EXPORTED = "attendance.exported"
    ATTENDANCE_CORRECTION_REQUESTED = "attendance.correction_requested"
    ATTENDANCE_CORRECTION_APPROVED = "attendance.correction_approved"
    ATTENDANCE_CORRECTION_REJECTED = "attendance.correction_rejected"
    ATTENDANCE_CORRECTION_CANCELLED = "attendance.correction_cancelled"
    
    LEAVE_TYPE_CREATED = "leave_type.created"
    LEAVE_TYPE_UPDATED = "leave_type.updated"
    LEAVE_TYPE_DELETED = "leave_type.deleted"

    LEAVE_BALANCE_CREATED = "leave_balance.created"
    LEAVE_BALANCE_UPDATED = "leave_balance.updated"
    LEAVE_BALANCES_INITIALIZED = "leave_balance.initialized"

    LEAVE_REQUESTED = "leave.requested"
    LEAVE_UPDATED = "leave.updated"
    LEAVE_APPROVED = "leave.approved"
    LEAVE_REJECTED = "leave.rejected"
    LEAVE_CANCELLED = "leave.cancelled"
    LEAVE_DOCUMENT_ADDED = "leave.document_added"
    LEAVE_DOCUMENT_REMOVED = "leave.document_removed"
    
    PAYROLL_SETTINGS_UPDATED = "payroll.settings_updated"
    PAY_ITEM_TYPE_CREATED = "pay_item_type.created"
    PAY_ITEM_TYPE_UPDATED = "pay_item_type.updated"
    PAY_ITEM_TYPE_DELETED = "pay_item_type.deleted"
    PAY_ELEMENT_CREATED = "pay_element.created"
    PAY_ELEMENT_ENDED = "pay_element.ended"

    PAYROLL_PERIOD_CREATED = "payroll_period.created"
    PAYROLL_PERIOD_UPDATED = "payroll_period.updated"
    PAYROLL_PERIOD_DELETED = "payroll_period.deleted"
    PAYROLL_PERIOD_CLOSED = "payroll_period.closed"
    PAYROLL_PERIOD_REOPENED = "payroll_period.reopened"
    PAYROLL_PERIOD_EXPORTED = "payroll_period.exported"

    PAYSLIPS_GENERATED = "payslip.generated"
    PAYSLIP_CALCULATED = "payslip.calculated"
    PAYSLIP_LINE_ADDED = "payslip.line_added"
    PAYSLIP_LINE_REMOVED = "payslip.line_removed"
    PAYSLIP_VALIDATED = "payslip.validated"
    PAYSLIP_PAID = "payslip.paid"
    PAYSLIP_CANCELLED = "payslip.cancelled"


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