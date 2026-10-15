from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Strictly read-only view of the audit trail."""

    list_display = ("created_at", "action", "actor_email", "target_type", "target_id", "ip_address")
    list_filter = ("action",)
    search_fields = ("actor_email", "action", "target_id")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False