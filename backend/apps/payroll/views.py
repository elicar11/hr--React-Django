import csv
from decimal import Decimal

from django.db.models import Count, DecimalField, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.http import StreamingHttpResponse
from django_filters import rest_framework as filters
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import generics, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import Role
from apps.accounts.permissions import IsAdminOrHR
from apps.core import audit
from apps.core.csv_utils import Echo, csv_safe
from apps.core.mixins import AuditedModelMixin
from apps.core.models import AuditAction

from . import services
from .models import (
    EmployeePayItem,
    PayItemType,
    PayrollPeriod,
    PayrollPeriodStatus,
    PayrollSettings,
    Payslip,
    PayslipStatus,
)
from .serializers import (
    CancelPayslipSerializer,
    CommentSerializer,
    EmployeePayItemCreateSerializer,
    EmployeePayItemSerializer,
    EndPayItemSerializer,
    ManualLineSerializer,
    PayItemTypeSerializer,
    PayPayslipSerializer,
    PayrollPeriodSerializer,
    PayrollSettingsSerializer,
    PayslipAdminSerializer,
    PayslipHistorySerializer,
    PayslipLineSerializer,
    PayslipListSerializer,
    PayslipSerializer,
)

ZERO = Value(Decimal("0.00"))
MONEY = DecimalField(max_digits=14, decimal_places=2)


def _is_hr(user):
    return user.role in (Role.ADMIN, Role.HR)


class PayrollSettingsView(generics.RetrieveUpdateAPIView):
    """Payroll parameters (singleton). ADMIN / HR; only an ADMIN can change the demo mode."""

    serializer_class = PayrollSettingsSerializer
    permission_classes = [IsAdminOrHR]
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        return PayrollSettings.get_solo()

    def perform_update(self, serializer):
        serializer.instance = services.update_settings(
            data=serializer.validated_data, actor=self.request.user, request=self.request
        )


class PayItemTypeViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    """Pay element types (ADMIN / HR). Deletion blocked when used."""

    queryset = PayItemType.objects.all()
    serializer_class = PayItemTypeSerializer
    permission_classes = [IsAdminOrHR]
    filterset_fields = ["category", "calculation", "applies_to_all", "is_active"]
    search_fields = ["code", "name"]
    ordering_fields = ["code", "name"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    audit_created = AuditAction.PAY_ITEM_TYPE_CREATED
    audit_updated = AuditAction.PAY_ITEM_TYPE_UPDATED
    audit_deleted = AuditAction.PAY_ITEM_TYPE_DELETED


class EmployeePayItemFilter(filters.FilterSet):
    active_on = filters.DateFilter(method="filter_active_on")

    class Meta:
        model = EmployeePayItem
        fields = ["employee", "item_type"]

    def filter_active_on(self, queryset, name, value):
        return queryset.filter(start_date__lte=value).filter(Q(end_date__isnull=True) | Q(end_date__gte=value))


class EmployeePayItemViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet
):
    """Remuneration elements of employees, with their history (ADMIN / HR). Immutable: end it, then create a new one."""

    queryset = EmployeePayItem.objects.select_related("employee", "item_type")
    permission_classes = [IsAdminOrHR]
    filterset_class = EmployeePayItemFilter
    ordering_fields = ["start_date"]

    def get_serializer_class(self):
        return {"create": EmployeePayItemCreateSerializer, "end": EndPayItemSerializer}.get(
            self.action, EmployeePayItemSerializer
        )

    @extend_schema(request=EmployeePayItemCreateSerializer, responses={201: EmployeePayItemSerializer})
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        element = services.create_pay_element(data=serializer.validated_data, actor=request.user, request=request)
        return Response(EmployeePayItemSerializer(element).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=EndPayItemSerializer, responses=EmployeePayItemSerializer)
    @action(detail=True, methods=["post"])
    def end(self, request, pk=None):
        """End the element (the history is kept)."""
        element = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        element = services.end_pay_element(
            element=element, end_date=serializer.validated_data["end_date"], actor=request.user, request=request
        )
        return Response(EmployeePayItemSerializer(element).data)


class _GenericResult:
    """Schema helper for bulk action responses."""


class PayrollPeriodViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    """Payroll periods and bulk operations (ADMIN / HR)."""

    serializer_class = PayrollPeriodSerializer
    permission_classes = [IsAdminOrHR]
    filterset_fields = ["status"]
    search_fields = ["code", "name"]
    ordering_fields = ["start_date", "code"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    audit_created = AuditAction.PAYROLL_PERIOD_CREATED
    audit_updated = AuditAction.PAYROLL_PERIOD_UPDATED
    audit_deleted = AuditAction.PAYROLL_PERIOD_DELETED

    def get_queryset(self):
        active = ~Q(payslips__status=PayslipStatus.CANCELLED)
        return PayrollPeriod.objects.annotate(
            payslips_count=Count("payslips", filter=active, distinct=True),
            total_gross=Coalesce(Sum("payslips__gross_pay", filter=active), ZERO, output_field=MONEY),
            total_deductions=Coalesce(Sum("payslips__total_deductions", filter=active), ZERO, output_field=MONEY),
            total_net=Coalesce(Sum("payslips__net_pay", filter=active), ZERO, output_field=MONEY),
        )

    def perform_create(self, serializer):
        serializer.instance = services.create_period(
            data=serializer.validated_data, actor=self.request.user, request=self.request
        )

    def perform_update(self, serializer):
        serializer.instance = services.update_period(
            period=serializer.instance, data=serializer.validated_data,
            actor=self.request.user, request=self.request,
        )

    def perform_destroy(self, instance):
        if instance.status != PayrollPeriodStatus.OPEN:
            raise PermissionDenied("Une période clôturée ne peut pas être supprimée.")
        super().perform_destroy(instance)

    @extend_schema(request=None, responses=OpenApiTypes.OBJECT)
    @action(detail=True, methods=["post"])
    def generate(self, request, pk=None):
        """Create the draft payslips of the period (employees employed and covered by a contract)."""
        return Response(services.generate_payslips(period=self.get_object(), actor=request.user, request=request))

    @extend_schema(request=None, responses=OpenApiTypes.OBJECT)
    @action(detail=True, methods=["post"], url_path="calculate")
    def calculate_all(self, request, pk=None):
        """Calculate all draft / calculated payslips. Errors are reported per payslip."""
        return Response(services.calculate_period(period=self.get_object(), actor=request.user, request=request))

    @extend_schema(request=CommentSerializer, responses=OpenApiTypes.OBJECT)
    @action(detail=True, methods=["post"], url_path="validate")
    def validate_all(self, request, pk=None):
        """Validate all calculated payslips (never your own). Errors are reported per payslip."""
        serializer = CommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(
            services.validate_period(
                period=self.get_object(), comment=serializer.validated_data["comment"],
                actor=request.user, request=request,
            )
        )

    @extend_schema(request=None, responses=PayrollPeriodSerializer)
    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        period = services.close_period(period=self.get_object(), actor=request.user, request=request)
        return Response(PayrollPeriodSerializer(period).data)

    @extend_schema(request=None, responses=PayrollPeriodSerializer)
    @action(detail=True, methods=["post"])
    def reopen(self, request, pk=None):
        """Reopen a closed period (ADMIN only)."""
        period = services.reopen_period(period=self.get_object(), actor=request.user, request=request)
        return Response(PayrollPeriodSerializer(period).data)

    @extend_schema(responses={200: OpenApiTypes.BINARY})
    @action(detail=True, methods=["get"])
    def export(self, request, pk=None):
        """CSV of the period's payslips (ADMIN / HR). Demo payslips are flagged."""
        period = self.get_object()
        audit.record(
            action=AuditAction.PAYROLL_PERIOD_EXPORTED, request=request, target=period,
            metadata={"code": period.code},
        )
        payslips = (
            Payslip.objects.filter(period=period)
            .exclude(status=PayslipStatus.CANCELLED)
            .select_related("employee")
            .order_by("employee__matricule")
        )
        writer = csv.writer(Echo(), delimiter=";")

        def rows():
            yield "\ufeff"
            yield writer.writerow([
                "Référence", "Matricule", "Nom", "Prénom", "Statut", "Brut", "Retenues", "Net", "Devise",
                "DÉMO - NON UTILISABLE POUR UNE PAIE RÉELLE",
            ])
            for p in payslips.iterator(chunk_size=1000):
                yield writer.writerow([
                    csv_safe(p.reference), csv_safe(p.employee.matricule), csv_safe(p.employee.last_name),
                    csv_safe(p.employee.first_name), p.status, p.gross_pay, p.total_deductions, p.net_pay,
                    p.currency, "OUI" if p.is_demo else "",
                ])

        response = StreamingHttpResponse(rows(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="paie-{period.code}.csv"'
        return response


class PayslipFilter(filters.FilterSet):
    department = filters.NumberFilter(field_name="employee__department")

    class Meta:
        model = Payslip
        fields = ["period", "employee", "status"]


class PayslipViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Payslips.

    ADMIN / HR: all payslips and every operation.
    EMPLOYEE: own payslips only, once validated or paid (404 on the others).
    """

    filterset_class = PayslipFilter
    search_fields = ["reference", "employee__matricule", "employee__last_name"]
    ordering_fields = ["net_pay", "gross_pay", "created_at"]

    def get_serializer_class(self):
        if self.action == "list":
            return PayslipListSerializer
        if self.action == "retrieve":
            return PayslipAdminSerializer if _is_hr(self.request.user) else PayslipSerializer
        return {
            "add_line": ManualLineSerializer,
            "validate_payslip": CommentSerializer,
            "pay": PayPayslipSerializer,
            "cancel": CancelPayslipSerializer,
            "history": PayslipHistorySerializer,
        }.get(self.action, PayslipSerializer)

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated()]
        return [IsAdminOrHR()]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Payslip.objects.none()
        queryset = Payslip.objects.select_related("employee", "employee__department", "period")
        if self.action == "retrieve":
            queryset = queryset.prefetch_related("lines")
        if _is_hr(self.request.user):
            return queryset
        return queryset.filter(
            employee__user=self.request.user, status__in=[PayslipStatus.VALIDATED, PayslipStatus.PAID]
        )

    @extend_schema(request=None, responses=PayslipAdminSerializer)
    @action(detail=True, methods=["post"])
    def calculate(self, request, pk=None):
        """(Re)calculate a draft or calculated payslip. Manual lines are kept."""
        payslip = services.calculate_payslip(payslip=self.get_object(), actor=request.user, request=request)
        return Response(PayslipAdminSerializer(payslip).data)

    @extend_schema(request=ManualLineSerializer, responses={201: PayslipLineSerializer})
    @action(detail=True, methods=["post"], url_path="lines")
    def add_line(self, request, pk=None):
        """Add a one-off element (fixed-amount type); the payslip is recalculated."""
        payslip = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        line = services.add_manual_line(
            payslip=payslip, actor=request.user, request=request, **serializer.validated_data
        )
        return Response(PayslipLineSerializer(line).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=None, responses={204: None})
    @action(detail=True, methods=["delete"], url_path=r"lines/(?P<line_id>[0-9]+)")
    def remove_line(self, request, pk=None, line_id=None):
        """Remove a manually added line; the payslip is recalculated."""
        payslip = self.get_object()
        line = get_object_or_404(payslip.lines, pk=line_id)
        services.remove_manual_line(payslip=payslip, line=line, actor=request.user, request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(request=CommentSerializer, responses=PayslipAdminSerializer)
    @action(detail=True, methods=["post"], url_path="validate")
    def validate_payslip(self, request, pk=None):
        """Validate a calculated payslip: it is then frozen (never your own)."""
        payslip = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payslip = services.validate_payslip(
            payslip=payslip, comment=serializer.validated_data["comment"], actor=request.user, request=request
        )
        return Response(PayslipAdminSerializer(payslip).data)

    @extend_schema(request=PayPayslipSerializer, responses=PayslipAdminSerializer)
    @action(detail=True, methods=["post"])
    def pay(self, request, pk=None):
        """Record the payment of a validated payslip."""
        payslip = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payslip = services.pay_payslip(
            payslip=payslip, actor=request.user, request=request, **serializer.validated_data
        )
        return Response(PayslipAdminSerializer(payslip).data)

    @extend_schema(request=CancelPayslipSerializer, responses=PayslipAdminSerializer)
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """Controlled cancellation (reason required). A validated payslip needs an ADMIN."""
        payslip = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payslip = services.cancel_payslip(
            payslip=payslip, reason=serializer.validated_data["reason"], actor=request.user, request=request
        )
        return Response(PayslipAdminSerializer(payslip).data)

    @extend_schema(responses=PayslipHistorySerializer(many=True))
    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        """Validation history (ADMIN / HR)."""
        payslip = self.get_object()
        return Response(PayslipHistorySerializer(payslip.history.all(), many=True).data)