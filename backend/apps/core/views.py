from django.http import JsonResponse
from django_filters import rest_framework as filters
from rest_framework import viewsets

from apps.accounts.permissions import IsAdmin

from .exceptions import GENERIC_MESSAGES, build_error
from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogFilter(filters.FilterSet):
    # action=auth. returns every authentication event, action=user. every user event...
    action = filters.CharFilter(lookup_expr="startswith")
    created_from = filters.IsoDateTimeFilter(field_name="created_at", lookup_expr="gte")
    created_to = filters.IsoDateTimeFilter(field_name="created_at", lookup_expr="lte")

    class Meta:
        model = AuditLog
        fields = ["actor", "target_type", "target_id"]


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only audit trail, restricted to administrators."""

    queryset = AuditLog.objects.select_related("actor")
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdmin]
    filterset_class = AuditLogFilter
    search_fields = ["actor_email", "action", "target_type", "target_id"]
    ordering_fields = ["created_at", "action"]


# JSON handlers for errors raised outside DRF (unknown URL, crash in middleware...).
def not_found(request, exception=None):
    body = build_error(code="not_found", message=GENERIC_MESSAGES[404], status_code=404)
    return JsonResponse(body, status=404)


def server_error(request):
    body = build_error(code="server_error", message=GENERIC_MESSAGES[500], status_code=500)
    return JsonResponse(body, status=500)