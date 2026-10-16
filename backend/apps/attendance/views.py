import csv

from django.http import StreamingHttpResponse
from django.utils import timezone
from django_filters import rest_framework as filters
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from django.db.models import Count, F, Q, Sum
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import Role
from apps.accounts.permissions import IsAdminOrHR, IsAdminOrHROrReadOnly
from apps.core import audit
from apps.core.mixins import AuditedModelMixin
from apps.core.models import AuditAction

from . import services
from .models import (
    AttendanceCorrection,
    AttendanceRecord,
    AttendanceStatus,
    Holiday,
    ScheduleAssignment,
    WorkSchedule,
)
from .serializers import (
    AttendanceCorrectionSerializer,
    AttendanceRecordSerializer,
    AttendanceSummarySerializer,
    AttendanceWriteSerializer,
    CorrectionRequestSerializer,
    DecisionSerializer,
    HolidaySerializer,
    RejectSerializer,
    ScheduleAssignmentSerializer,
    WorkScheduleSerializer,
)


def _is_hr(user):
    return user.role in (Role.ADMIN, Role.HR)


# --- Schedules, assignments, holidays ------------------------------------------------------


class WorkScheduleViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    """Work schedules. Read: any user. Write: ADMIN / HR. Deletion blocked when used."""

    queryset = WorkSchedule.objects.all()
    serializer_class = WorkScheduleSerializer
    permission_classes = [IsAdminOrHROrReadOnly]
    search_fields = ["code", "name"]
    ordering_fields = ["code", "name"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    audit_created = AuditAction.WORK_SCHEDULE_CREATED
    audit_updated = AuditAction.WORK_SCHEDULE_UPDATED
    audit_deleted = AuditAction.WORK_SCHEDULE_DELETED

    @extend_schema(request=None, responses=WorkScheduleSerializer)
    @action(detail=True, methods=["post"], url_path="set-default")
    def set_default(self, request, pk=None):
        """Make this schedule the default one (used by employees without an assigned schedule)."""
        schedule = services.set_default_schedule(
            schedule=self.get_object(), actor=request.user, request=request
        )
        return Response(WorkScheduleSerializer(schedule).data)


class ScheduleAssignmentViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet
):
    """Schedule of each employee over time (ADMIN / HR)."""

    queryset = ScheduleAssignment.objects.select_related("employee", "schedule")
    serializer_class = ScheduleAssignmentSerializer
    permission_classes = [IsAdminOrHR]
    filterset_fields = ["employee", "schedule"]
    ordering_fields = ["start_date"]

    def perform_create(self, serializer):
        serializer.instance = services.assign_schedule(
            actor=self.request.user, request=self.request, **serializer.validated_data
        )


class HolidayFilter(filters.FilterSet):
    class Meta:
        model = Holiday
        fields = {"date": ["exact", "gte", "lte", "year"]}


class HolidayViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    """Public holidays. Read: any user. Write: ADMIN / HR."""

    queryset = Holiday.objects.all()
    serializer_class = HolidaySerializer
    permission_classes = [IsAdminOrHROrReadOnly]
    filterset_class = HolidayFilter
    search_fields = ["name"]
    ordering_fields = ["date"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    audit_created = AuditAction.HOLIDAY_CREATED
    audit_updated = AuditAction.HOLIDAY_UPDATED
    audit_deleted = AuditAction.HOLIDAY_DELETED
    audit_label_field = "date"


# --- Attendance records ----------------------------------------------------------------------


class AttendanceFilter(filters.FilterSet):
    date_from = filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = filters.DateFilter(field_name="date", lookup_expr="lte")
    department = filters.NumberFilter(field_name="employee__department")
    late = filters.BooleanFilter(method="filter_late")
    has_overtime = filters.BooleanFilter(method="filter_overtime")

    class Meta:
        model = AttendanceRecord
        fields = ["employee", "status", "source", "date"]

    def filter_late(self, queryset, name, value):
        return queryset.filter(late_minutes__gt=0) if value else queryset.filter(late_minutes=0)

    def filter_overtime(self, queryset, name, value):
        return queryset.filter(overtime_minutes__gt=0) if value else queryset.filter(overtime_minutes=0)


class _Echo:
    """File-like object returning what is written, for streaming CSV."""

    def write(self, value):
        return value


def _csv_safe(value):
    """Neutralize spreadsheet formulas (CSV injection) in text cells."""
    text = "" if value is None else str(value)
    return "'" + text if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


def _local(value):
    return timezone.localtime(value).strftime("%Y-%m-%d %H:%M") if value else ""


class AttendanceViewSet(viewsets.ModelViewSet):
    """Attendance records.

    ADMIN / HR: full access (manual records, corrections, export).
    EMPLOYEE: read-only access to their own records, plus clock in / out for themselves.
    Presences are never deleted (only absences can be).
    """

    permission_classes = [IsAdminOrHROrReadOnly]
    filterset_class = AttendanceFilter
    search_fields = ["employee__matricule", "employee__last_name", "employee__first_name"]
    ordering_fields = ["date", "late_minutes", "overtime_minutes", "worked_minutes"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_serializer_class(self):
        if self.action in ("create", "partial_update"):
            return AttendanceWriteSerializer
        if self.action == "summary":
            return AttendanceSummarySerializer
        return AttendanceRecordSerializer

    def get_permissions(self):
        if self.action in ("check_in", "check_out", "today"):
            return [IsAuthenticated()]  # self-service: the employee linked to the account
        if self.action == "export":
            return [IsAdminOrHR()]
        return super().get_permissions()

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return AttendanceRecord.objects.none()
        queryset = AttendanceRecord.objects.select_related("employee", "employee__department", "schedule")
        if _is_hr(self.request.user):
            return queryset
        return queryset.filter(employee__user=self.request.user)  # own records only

    # --- ADMIN / HR writes -------------------------------------------------------
    @extend_schema(request=AttendanceWriteSerializer, responses={201: AttendanceRecordSerializer})
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        record = services.create_manual_record(
            data=serializer.validated_data, actor=request.user, request=request
        )
        return Response(AttendanceRecordSerializer(record).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=AttendanceWriteSerializer, responses=AttendanceRecordSerializer)
    def partial_update(self, request, *args, **kwargs):
        record = self.get_object()
        serializer = self.get_serializer(record, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        record = services.update_record(
            record=record, data=serializer.validated_data, actor=request.user, request=request
        )
        return Response(AttendanceRecordSerializer(record).data)

    def perform_destroy(self, instance):
        services.delete_record(record=instance, actor=self.request.user, request=self.request)

    # --- Self-service clock ----------------------------------------------------------
    @extend_schema(request=None, responses={201: AttendanceRecordSerializer})
    @action(detail=False, methods=["post"], url_path="check-in")
    def check_in(self, request):
        """Clock in now (server time) for the employee linked to the connected account."""
        employee = services.get_employee_for_user(request.user)
        record = services.check_in(employee=employee, actor=request.user, request=request)
        return Response(AttendanceRecordSerializer(record).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=None, responses=AttendanceRecordSerializer)
    @action(detail=False, methods=["post"], url_path="check-out")
    def check_out(self, request):
        """Clock out now (server time)."""
        employee = services.get_employee_for_user(request.user)
        record = services.check_out(employee=employee, actor=request.user, request=request)
        return Response(AttendanceRecordSerializer(record).data)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    @action(detail=False, methods=["get"])
    def today(self, request):
        """Today's schedule and clock status for the connected employee."""
        employee = services.get_employee_for_user(request.user)
        overview = services.today_overview(employee)
        schedule, record = overview["schedule"], overview["record"]
        return Response(
            {
                "date": overview["date"].isoformat(),
                "is_working_day": overview["is_working_day"],
                "schedule": WorkScheduleSerializer(schedule).data if schedule else None,
                "record": AttendanceRecordSerializer(record).data if record else None,
            }
        )

    # --- Reports -------------------------------------------------------------------
    @extend_schema(responses=AttendanceSummarySerializer(many=True))
    @action(detail=False, methods=["get"], filter_backends=[DjangoFilterBackend])
    def summary(self, request):
        """Per-employee totals over the filtered period (date_from, date_to, department, employee...)."""
        queryset = self.filter_queryset(self.get_queryset())
        rows = (
            queryset.order_by()
            .values(
                "employee_id",
                matricule=F("employee__matricule"),
                last_name=F("employee__last_name"),
                first_name=F("employee__first_name"),
            )
            .annotate(
                days_present=Count("id", filter=Q(status=AttendanceStatus.PRESENT)),
                days_absent_justified=Count("id", filter=Q(status=AttendanceStatus.ABSENT_JUSTIFIED)),
                days_absent_unjustified=Count("id", filter=Q(status=AttendanceStatus.ABSENT_UNJUSTIFIED)),
                late_count=Count("id", filter=Q(late_minutes__gt=0)),
                total_late_minutes=Sum("late_minutes"),
                total_worked_minutes=Sum("worked_minutes"),
                total_overtime_minutes=Sum("overtime_minutes"),
            )
            .order_by("last_name", "first_name")
        )
        page = self.paginate_queryset(rows)
        return self.get_paginated_response(AttendanceSummarySerializer(page, many=True).data)

    @extend_schema(responses={200: OpenApiTypes.BINARY})
    @action(detail=False, methods=["get"])
    def export(self, request):
        """CSV export of the filtered records (ADMIN / HR). Absence reasons are not exported."""
        queryset = self.filter_queryset(self.get_queryset())
        audit.record(
            action=AuditAction.ATTENDANCE_EXPORTED,
            request=request,
            metadata={"query": request.query_params.urlencode()},
        )
        writer = csv.writer(_Echo(), delimiter=";")  # ';' opens correctly in French spreadsheets

        def rows():
            yield "\ufeff"  # BOM so Excel reads UTF-8
            yield writer.writerow([
                "Matricule", "Nom", "Prénom", "Département", "Date", "Statut", "Source",
                "Entrée", "Sortie", "Minutes travaillées", "Retard (min)", "Heures sup (min)",
            ])
            for r in queryset.iterator(chunk_size=2000):
                yield writer.writerow([
                    _csv_safe(r.employee.matricule),
                    _csv_safe(r.employee.last_name),
                    _csv_safe(r.employee.first_name),
                    _csv_safe(r.employee.department.name),
                    r.date.isoformat(),
                    r.status,
                    r.source,
                    _local(r.check_in),
                    _local(r.check_out),
                    r.worked_minutes,
                    r.late_minutes,
                    r.overtime_minutes,
                ])

        response = StreamingHttpResponse(rows(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="presences.csv"'
        return response


# --- Correction requests ------------------------------------------------------------------------


class CorrectionFilter(filters.FilterSet):
    date_from = filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = filters.DateFilter(field_name="date", lookup_expr="lte")

    class Meta:
        model = AttendanceCorrection
        fields = ["employee", "status"]


class AttendanceCorrectionViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet
):
    """Correction requests: an employee asks, ADMIN / HR decide.

    EMPLOYEE: creates, reads and cancels their own requests. ADMIN / HR: read all, approve or reject.
    """

    filterset_class = CorrectionFilter
    search_fields = ["employee__matricule", "employee__last_name"]
    ordering_fields = ["created_at", "date"]

    def get_serializer_class(self):
        return {
            "create": CorrectionRequestSerializer,
            "approve": DecisionSerializer,
            "reject": RejectSerializer,
        }.get(self.action, AttendanceCorrectionSerializer)

    def get_permissions(self):
        if self.action in ("approve", "reject"):
            return [IsAdminOrHR()]
        return [IsAuthenticated()]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return AttendanceCorrection.objects.none()
        queryset = AttendanceCorrection.objects.select_related("employee")
        if _is_hr(self.request.user):
            return queryset
        return queryset.filter(employee__user=self.request.user)

    @extend_schema(request=CorrectionRequestSerializer, responses={201: AttendanceCorrectionSerializer})
    def create(self, request, *args, **kwargs):
        """The connected employee asks for a correction of one of their days."""
        employee = services.get_employee_for_user(request.user)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        correction = services.request_correction(
            employee=employee, data=serializer.validated_data, actor=request.user, request=request
        )
        return Response(AttendanceCorrectionSerializer(correction).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=DecisionSerializer, responses=AttendanceCorrectionSerializer)
    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Approve: the record of that day is created or replaced (source MANUAL)."""
        correction = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        correction = services.approve_correction(
            correction=correction,
            comment=serializer.validated_data["comment"],
            actor=request.user,
            request=request,
        )
        return Response(AttendanceCorrectionSerializer(correction).data)

    @extend_schema(request=RejectSerializer, responses=AttendanceCorrectionSerializer)
    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        correction = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        correction = services.reject_correction(
            correction=correction,
            comment=serializer.validated_data["comment"],
            actor=request.user,
            request=request,
        )
        return Response(AttendanceCorrectionSerializer(correction).data)

    @extend_schema(request=None, responses=AttendanceCorrectionSerializer)
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """The requesting employee withdraws a pending request."""
        correction = services.cancel_correction(
            correction=self.get_object(), actor=request.user, request=request
        )
        return Response(AttendanceCorrectionSerializer(correction).data)