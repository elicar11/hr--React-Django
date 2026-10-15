import mimetypes

from django.http import FileResponse
from django_filters import rest_framework as filters
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from apps.accounts.models import Role
from apps.accounts.permissions import IsAdminOrHR, IsAdminOrHROrReadOnly
from apps.core.models import AuditLog

from . import services
from .models import Employee
from .serializers import (
    AssignmentSerializer,
    AssignSerializer,
    EmployeeCreateSerializer,
    EmployeeHistorySerializer,
    EmployeeListSerializer,
    EmployeeSerializer,
    PhotoUploadSerializer,
    TerminateSerializer,
)


class EmployeeFilter(filters.FilterSet):
    hire_date_from = filters.DateFilter(field_name="hire_date", lookup_expr="gte")
    hire_date_to = filters.DateFilter(field_name="hire_date", lookup_expr="lte")

    class Meta:
        model = Employee
        fields = ["employment_status", "department", "position"]


class EmployeeViewSet(viewsets.ModelViewSet):
    """Employee records.

    ADMIN / HR: full access. EMPLOYEE: read-only access to their own record
    (other records answer 404 so their existence is not revealed).
    No DELETE: records are never hard-deleted.
    """

    permission_classes = [IsAdminOrHROrReadOnly]
    filterset_class = EmployeeFilter
    search_fields = ["matricule", "first_name", "last_name", "work_email"]
    ordering_fields = ["matricule", "last_name", "first_name", "hire_date", "created_at"]
    http_method_names = ["get", "post", "patch", "head", "options"]

    serializer_classes = {
        "list": EmployeeListSerializer,
        "create": EmployeeCreateSerializer,
        "assign": AssignSerializer,
        "assignments": AssignmentSerializer,
        "terminate": TerminateSerializer,
        "history": EmployeeHistorySerializer,
        "photo": PhotoUploadSerializer,
    }

    def get_serializer_class(self):
        return self.serializer_classes.get(self.action, EmployeeSerializer)

    def get_permissions(self):
        if self.action == "history":  # GET, but reserved to ADMIN / HR
            return [IsAdminOrHR()]
        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Employee.objects.none()
        queryset = Employee.objects.select_related("department", "position", "user")
        user = self.request.user
        if user.role in (Role.ADMIN, Role.HR):
            return queryset
        return queryset.filter(user=user)  # object-level access: own record only

    def perform_create(self, serializer):
        serializer.instance = services.create_employee(
            data=serializer.validated_data, actor=self.request.user, request=self.request
        )

    def perform_update(self, serializer):
        serializer.instance = services.update_employee(
            employee=serializer.instance,
            data=serializer.validated_data,
            actor=self.request.user,
            request=self.request,
        )

    # --- Own record ---------------------------------------------------------
    @extend_schema(responses=EmployeeSerializer)
    @action(detail=False, methods=["get"])
    def me(self, request):
        """Employee record linked to the connected user's account."""
        employee = self.get_queryset().filter(user=request.user).first()
        if employee is None:
            raise NotFound("Aucun dossier employé n'est associé à votre compte.")
        return Response(EmployeeSerializer(employee).data)

    # --- Assignments --------------------------------------------------------
    @extend_schema(responses=AssignmentSerializer(many=True))
    @action(detail=True, methods=["get"])
    def assignments(self, request, pk=None):
        """Assignment history (most recent first)."""
        employee = self.get_object()
        queryset = employee.assignments.select_related("department", "position")
        return Response(AssignmentSerializer(queryset, many=True).data)

    @extend_schema(request=AssignSerializer, responses=EmployeeSerializer)
    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        """Move the employee to another department / position from a given date."""
        employee = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        employee = services.assign(
            employee=employee, actor=request.user, request=request, **serializer.validated_data
        )
        return Response(EmployeeSerializer(employee).data)

    # --- Status lifecycle ---------------------------------------------------
    @extend_schema(request=None, responses=EmployeeSerializer)
    @action(detail=True, methods=["post"])
    def suspend(self, request, pk=None):
        employee = services.suspend(employee=self.get_object(), actor=request.user, request=request)
        return Response(EmployeeSerializer(employee).data)

    @extend_schema(request=TerminateSerializer, responses=EmployeeSerializer)
    @action(detail=True, methods=["post"])
    def terminate(self, request, pk=None):
        employee = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        employee = services.terminate(
            employee=employee,
            departure_date=serializer.validated_data["departure_date"],
            actor=request.user,
            request=request,
        )
        return Response(EmployeeSerializer(employee).data)

    @extend_schema(request=None, responses=EmployeeSerializer)
    @action(detail=True, methods=["post"])
    def reactivate(self, request, pk=None):
        employee = services.reactivate(employee=self.get_object(), actor=request.user, request=request)
        return Response(EmployeeSerializer(employee).data)

    # --- Photo --------------------------------------------------------------
    @extend_schema(methods=["GET"], request=None, responses={200: OpenApiTypes.BINARY})
    @extend_schema(
        methods=["POST"],
        request={"multipart/form-data": PhotoUploadSerializer},
        responses=EmployeeSerializer,
    )
    @extend_schema(methods=["DELETE"], request=None, responses={204: None})
    @action(detail=True, methods=["get", "post", "delete"], parser_classes=[MultiPartParser])
    def photo(self, request, pk=None):
        """GET: read the photo (permission checked on every read). POST / DELETE: ADMIN / HR."""
        employee = self.get_object()

        if request.method == "GET":
            if not employee.photo:
                raise NotFound("Aucune photo pour cet employé.")
            content_type = mimetypes.guess_type(employee.photo.name)[0] or "application/octet-stream"
            response = FileResponse(employee.photo.open("rb"), content_type=content_type)
            response["Cache-Control"] = "private, no-cache"
            return response

        if request.method == "POST":
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            employee = services.set_photo(
                employee=employee,
                photo=serializer.validated_data["photo"],
                actor=request.user,
                request=request,
            )
            return Response(EmployeeSerializer(employee).data)

        services.remove_photo(employee=employee, actor=request.user, request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)

    # --- Change history (ADMIN / HR) -----------------------------------------
    @extend_schema(responses=EmployeeHistorySerializer(many=True))
    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        """Audit trail of this employee: who changed what, and when."""
        employee = self.get_object()
        entries = AuditLog.objects.filter(
            target_type=Employee._meta.label_lower, target_id=str(employee.pk)
        )
        page = self.paginate_queryset(entries)
        return self.get_paginated_response(EmployeeHistorySerializer(page, many=True).data)