import mimetypes

from django.db.models import Count
from django.http import FileResponse
from django_filters import rest_framework as filters
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.generics import get_object_or_404
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import Role
from apps.accounts.permissions import IsAdminOrHR, IsAdminOrHROrReadOnly
from apps.attendance.models import Holiday
from apps.attendance.serializers import HolidaySerializer
from apps.core.mixins import AuditedModelMixin
from apps.core.models import AuditAction
from apps.employees.models import Employee

from . import services
from .models import LeaveBalance, LeaveRequest, LeaveStatus, LeaveType
from .serializers import (
    CalendarQuerySerializer,
    DecisionSerializer,
    InitializeBalancesSerializer,
    LeaveBalanceCreateSerializer,
    LeaveBalanceSerializer,
    LeaveBalanceUpdateSerializer,
    LeaveDocumentSerializer,
    LeaveDocumentUploadSerializer,
    LeaveHistorySerializer,
    LeaveRequestCreateSerializer,
    LeaveRequestSerializer,
    LeaveRequestUpdateSerializer,
    LeaveTypeSerializer,
    RejectSerializer,
)


def _is_hr(user):
    return user.role in (Role.ADMIN, Role.HR)


class LeaveTypeViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    """Leave types. Read: any user. Write: ADMIN / HR. Deletion blocked when used."""

    queryset = LeaveType.objects.all()
    serializer_class = LeaveTypeSerializer
    permission_classes = [IsAdminOrHROrReadOnly]
    filterset_fields = ["is_active", "uses_balance", "is_paid"]
    search_fields = ["code", "name"]
    ordering_fields = ["code", "name"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    audit_created = AuditAction.LEAVE_TYPE_CREATED
    audit_updated = AuditAction.LEAVE_TYPE_UPDATED
    audit_deleted = AuditAction.LEAVE_TYPE_DELETED


class LeaveBalanceViewSet(viewsets.ModelViewSet):
    """Leave balances. ADMIN / HR: all, and write. EMPLOYEE: own balances, read-only."""

    permission_classes = [IsAdminOrHROrReadOnly]
    filterset_fields = ["employee", "leave_type", "year"]
    search_fields = ["employee__matricule", "employee__last_name"]
    ordering_fields = ["year"]
    http_method_names = ["get", "post", "patch", "head", "options"]  # no delete: balances are history

    def get_serializer_class(self):
        return {
            "create": LeaveBalanceCreateSerializer,
            "partial_update": LeaveBalanceUpdateSerializer,
            "initialize": InitializeBalancesSerializer,
        }.get(self.action, LeaveBalanceSerializer)

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return LeaveBalance.objects.none()
        queryset = LeaveBalance.objects.select_related("employee", "leave_type")
        if _is_hr(self.request.user):
            return queryset
        return queryset.filter(employee__user=self.request.user)

    @extend_schema(request=LeaveBalanceCreateSerializer, responses={201: LeaveBalanceSerializer})
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        balance = services.create_balance(data=serializer.validated_data, actor=request.user, request=request)
        return Response(LeaveBalanceSerializer(balance).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=LeaveBalanceUpdateSerializer, responses=LeaveBalanceSerializer)
    def partial_update(self, request, *args, **kwargs):
        balance = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        balance = services.update_balance(
            balance=balance, allocated=serializer.validated_data["allocated"],
            actor=request.user, request=request,
        )
        return Response(LeaveBalanceSerializer(balance).data)

    @extend_schema(request=InitializeBalancesSerializer, responses=OpenApiTypes.OBJECT)
    @action(detail=False, methods=["post"])
    def initialize(self, request):
        """Create the year's balances of active employees from the types' annual allowances."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        year = serializer.validated_data["year"]
        created = services.initialize_balances(year=year, actor=request.user, request=request)
        return Response({"year": year, "created": created})


class LeaveRequestFilter(filters.FilterSet):
    # An interval [period_from, period_to] selects the requests overlapping it.
    period_from = filters.DateFilter(field_name="end_date", lookup_expr="gte")
    period_to = filters.DateFilter(field_name="start_date", lookup_expr="lte")
    department = filters.NumberFilter(field_name="employee__department")

    class Meta:
        model = LeaveRequest
        fields = ["employee", "leave_type", "status"]


class LeaveRequestViewSet(viewsets.ModelViewSet):
    """Leave requests.

    EMPLOYEE: creates, reads, edits (while pending) and cancels their own requests.
    ADMIN / HR: read all, request on behalf, approve or reject (never their own request).
    Requests are never deleted: they are cancelled.
    """

    filterset_class = LeaveRequestFilter
    search_fields = ["employee__matricule", "employee__last_name", "employee__first_name"]
    ordering_fields = ["start_date", "created_at", "days"]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_serializer_class(self):
        return {
            "create": LeaveRequestCreateSerializer,
            "partial_update": LeaveRequestUpdateSerializer,
            "approve": DecisionSerializer,
            "cancel": DecisionSerializer,
            "reject": RejectSerializer,
            "history": LeaveHistorySerializer,
            "documents": LeaveDocumentSerializer,
        }.get(self.action, LeaveRequestSerializer)

    def get_permissions(self):
        if self.action in ("approve", "reject"):
            return [IsAdminOrHR()]
        return [IsAuthenticated()]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return LeaveRequest.objects.none()
        queryset = LeaveRequest.objects.select_related(
            "employee", "employee__department", "leave_type"
        ).annotate(documents_count=Count("documents"))
        if _is_hr(self.request.user):
            return queryset
        return queryset.filter(employee__user=self.request.user)  # own requests only

    # --- Create / edit -----------------------------------------------------------
    @extend_schema(request=LeaveRequestCreateSerializer, responses={201: LeaveRequestSerializer})
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        target = data.pop("employee", None)
        own = Employee.objects.filter(user=request.user).first()

        if _is_hr(request.user):
            employee = target or own
            if employee is None:
                raise ValidationError({"employee": "Indiquez l'employé concerné."})
        else:
            if own is None:
                raise ValidationError("Aucun dossier employé n'est associé à votre compte.")
            if target is not None and target.pk != own.pk:
                raise PermissionDenied("Vous ne pouvez faire une demande que pour vous-même.")
            employee = own

        leave = services.create_request(employee=employee, data=data, actor=request.user, request=request)
        return Response(LeaveRequestSerializer(leave).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=LeaveRequestUpdateSerializer, responses=LeaveRequestSerializer)
    def partial_update(self, request, *args, **kwargs):
        """Edit a pending request (dates, type, reason); the day count is recomputed."""
        leave = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        leave = services.update_request(
            leave=leave, data=serializer.validated_data, actor=request.user, request=request
        )
        return Response(LeaveRequestSerializer(leave).data)

    # --- Decisions ------------------------------------------------------------------
    @extend_schema(request=DecisionSerializer, responses=LeaveRequestSerializer)
    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Approve: the balance is updated in the same transaction (ADMIN / HR)."""
        leave = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        leave = services.approve_request(
            leave=leave, comment=serializer.validated_data["comment"], actor=request.user, request=request
        )
        return Response(LeaveRequestSerializer(leave).data)

    @extend_schema(request=RejectSerializer, responses=LeaveRequestSerializer)
    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        leave = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        leave = services.reject_request(
            leave=leave, comment=serializer.validated_data["comment"], actor=request.user, request=request
        )
        return Response(LeaveRequestSerializer(leave).data)

    @extend_schema(request=DecisionSerializer, responses=LeaveRequestSerializer)
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """Cancel a request. An approved one gives its days back to the balance."""
        leave = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        leave = services.cancel_request(
            leave=leave, comment=serializer.validated_data["comment"], actor=request.user, request=request
        )
        return Response(LeaveRequestSerializer(leave).data)

    # --- History & calendar ------------------------------------------------------------
    @extend_schema(responses=LeaveHistorySerializer(many=True))
    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        """Validation history: who did what, when, with which comment."""
        leave = self.get_object()
        return Response(LeaveHistorySerializer(leave.history.all(), many=True).data)

    @extend_schema(parameters=[CalendarQuerySerializer], responses=OpenApiTypes.OBJECT)
    @action(detail=False, methods=["get"])
    def calendar(self, request):
        """Pending and approved leaves overlapping a period, with the holidays (HR calendar)."""
        query = CalendarQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        date_from, date_to = query.validated_data["date_from"], query.validated_data["date_to"]
        queryset = (
            self.filter_queryset(self.get_queryset())
            .filter(
                status__in=[LeaveStatus.PENDING, LeaveStatus.APPROVED],
                end_date__gte=date_from,
                start_date__lte=date_to,
            )
            .order_by("start_date")
        )
        holidays = Holiday.objects.filter(date__range=(date_from, date_to))
        return Response(
            {
                "leaves": LeaveRequestSerializer(queryset, many=True).data,
                "holidays": HolidaySerializer(holidays, many=True).data,
            }
        )

    # --- Supporting documents -------------------------------------------------------------
    @extend_schema(methods=["GET"], request=None, responses=LeaveDocumentSerializer(many=True))
    @extend_schema(
        methods=["POST"],
        request={"multipart/form-data": LeaveDocumentUploadSerializer},
        responses={201: LeaveDocumentSerializer},
    )
    @action(detail=True, methods=["get", "post"], parser_classes=[MultiPartParser])
    def documents(self, request, pk=None):
        """GET: list the supporting documents. POST: attach one (PDF / JPEG / PNG, 5 MB max)."""
        leave = self.get_object()
        if request.method == "GET":
            return Response(LeaveDocumentSerializer(leave.documents.all(), many=True).data)
        serializer = LeaveDocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        document = services.add_document(
            leave=leave, actor=request.user, request=request, **serializer.validated_data
        )
        return Response(LeaveDocumentSerializer(document).data, status=status.HTTP_201_CREATED)

    @extend_schema(
        methods=["GET"],
        request=None,
        parameters=[OpenApiParameter("document_id", OpenApiTypes.INT, OpenApiParameter.PATH)],
        responses={200: OpenApiTypes.BINARY},
    )
    @extend_schema(
        methods=["DELETE"],
        request=None,
        parameters=[OpenApiParameter("document_id", OpenApiTypes.INT, OpenApiParameter.PATH)],
        responses={204: None},
    )
    @action(detail=True, methods=["get", "delete"], url_path=r"documents/(?P<document_id>[0-9]+)")
    def document(self, request, pk=None, document_id=None):
        """GET: download (permission checked on every read). DELETE: owner while pending, or ADMIN / HR."""
        leave = self.get_object()
        document = get_object_or_404(leave.documents, pk=document_id)

        if request.method == "GET":
            content_type = mimetypes.guess_type(document.file.name)[0] or "application/octet-stream"
            extension = document.file.name.rsplit(".", 1)[-1]
            response = FileResponse(
                document.file.open("rb"),
                content_type=content_type,
                as_attachment=True,
                filename=f"justificatif-{leave.pk}-{document.pk}.{extension}",
            )
            response["Cache-Control"] = "private, no-cache"
            return response

        services.remove_document(document=document, actor=request.user, request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)