from django.db.models import Count, Q
from django_filters import rest_framework as filters
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.permissions import IsAdminOrHROrReadOnly
from apps.core.mixins import AuditedModelMixin
from apps.core.models import AuditAction

from . import services
from .models import Department, Position
from .serializers import DepartmentSerializer, PositionSerializer


class DepartmentFilter(filters.FilterSet):
    class Meta:
        model = Department
        fields = {"is_active": ["exact"], "parent": ["exact", "isnull"]}


class DepartmentViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    """Departments. Read: any user. Write: ADMIN / HR. Deletion blocked when referenced."""

    serializer_class = DepartmentSerializer
    permission_classes = [IsAdminOrHROrReadOnly]
    filterset_class = DepartmentFilter
    search_fields = ["code", "name"]
    ordering_fields = ["code", "name", "created_at"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    audit_created = AuditAction.DEPARTMENT_CREATED
    audit_updated = AuditAction.DEPARTMENT_UPDATED
    audit_deleted = AuditAction.DEPARTMENT_DELETED

    # DepartmentViewSet
    def get_queryset(self):
        return Department.objects.select_related("parent").annotate(
            children_count=Count("children", distinct=True),
            positions_count=Count("positions", distinct=True),
            employees_count=Count(
                "employees", filter=~Q(employees__employment_status="TERMINATED"), distinct=True
            ),
        )

    @extend_schema(
        parameters=[OpenApiParameter("include_inactive", OpenApiTypes.BOOL, required=False)],
        responses=OpenApiTypes.OBJECT,
    )
    @action(detail=False, methods=["get"])
    def tree(self, request):
        """Nested hierarchy of departments (active ones unless include_inactive=true)."""
        include_inactive = request.query_params.get("include_inactive", "").lower() in ("1", "true")
        return Response(services.build_department_tree(include_inactive=include_inactive))

    @extend_schema(request=None, responses=DepartmentSerializer)
    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        department = services.set_department_active(
            actor=request.user, department=self.get_object(), is_active=False, request=request
        )
        return Response(DepartmentSerializer(department).data)

    @extend_schema(request=None, responses=DepartmentSerializer)
    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        department = services.set_department_active(
            actor=request.user, department=self.get_object(), is_active=True, request=request
        )
        return Response(DepartmentSerializer(department).data)


class PositionFilter(filters.FilterSet):
    class Meta:
        model = Position
        fields = {
            "is_active": ["exact"],
            "department": ["exact", "isnull"],
            "level": ["exact", "gte", "lte"],
        }


class PositionViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    """Positions. Read: any user. Write: ADMIN / HR. Deletion blocked when referenced."""

    serializer_class = PositionSerializer
    permission_classes = [IsAdminOrHROrReadOnly]
    filterset_class = PositionFilter
    search_fields = ["code", "title"]
    ordering_fields = ["code", "title", "level", "created_at"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    audit_created = AuditAction.POSITION_CREATED
    audit_updated = AuditAction.POSITION_UPDATED
    audit_deleted = AuditAction.POSITION_DELETED

    # PositionViewSet
    def get_queryset(self):
        return Position.objects.select_related("department").annotate(
            employees_count=Count(
                "employees", filter=~Q(employees__employment_status="TERMINATED"), distinct=True
            ),
        )

    @extend_schema(request=None, responses=PositionSerializer)
    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        position = services.set_position_active(
            actor=request.user, position=self.get_object(), is_active=False, request=request
        )
        return Response(PositionSerializer(position).data)

    @extend_schema(request=None, responses=PositionSerializer)
    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        position = services.set_position_active(
            actor=request.user, position=self.get_object(), is_active=True, request=request
        )
        return Response(PositionSerializer(position).data)