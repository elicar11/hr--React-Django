from datetime import timedelta

from django.conf import settings
from django.http import FileResponse
from django.utils import timezone
from django_filters import rest_framework as filters
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.generics import get_object_or_404
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from apps.accounts.models import Role
from apps.accounts.permissions import IsAdminOrHR, IsAdminOrHROrReadOnly
from apps.core.mixins import AuditedModelMixin
from apps.core.models import AuditAction, AuditLog

from . import services
from .models import Contract, ContractStatus, ContractType
from .serializers import (
    ActivateSerializer,
    ContractDocumentSerializer,
    ContractDocumentUploadSerializer,
    ContractHistorySerializer,
    ContractListSerializer,
    ContractSerializer,
    ContractTypeSerializer,
    RenewSerializer,
    TerminateContractSerializer,
)


class ContractTypeViewSet(AuditedModelMixin, viewsets.ModelViewSet):
    """Contract types. Read: any user. Write: ADMIN / HR. Deletion blocked when used."""

    queryset = ContractType.objects.all()
    serializer_class = ContractTypeSerializer
    permission_classes = [IsAdminOrHROrReadOnly]
    filterset_fields = ["is_active", "is_fixed_term"]
    search_fields = ["code", "name"]
    ordering_fields = ["code", "name"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    audit_created = AuditAction.CONTRACT_TYPE_CREATED
    audit_updated = AuditAction.CONTRACT_TYPE_UPDATED
    audit_deleted = AuditAction.CONTRACT_TYPE_DELETED


class ContractFilter(filters.FilterSet):
    start_date_from = filters.DateFilter(field_name="start_date", lookup_expr="gte")
    start_date_to = filters.DateFilter(field_name="start_date", lookup_expr="lte")
    end_date_from = filters.DateFilter(field_name="end_date", lookup_expr="gte")
    end_date_to = filters.DateFilter(field_name="end_date", lookup_expr="lte")

    class Meta:
        model = Contract
        fields = ["employee", "contract_type", "status", "position"]


def _alert_days(request):
    raw = request.query_params.get("days")
    if raw is None:
        return settings.CONTRACT_ALERT_DAYS
    try:
        days = int(raw)
    except ValueError:
        days = 0
    if not 1 <= days <= 365:
        raise ValidationError({"days": "Valeur attendue : un entier entre 1 et 365."})
    return days


class ContractViewSet(viewsets.ModelViewSet):
    """Contracts.

    ADMIN / HR: full access. EMPLOYEE: read-only access to their own non-draft contracts
    (other contracts answer 404). Only drafts can be edited or deleted.
    """

    permission_classes = [IsAdminOrHROrReadOnly]
    filterset_class = ContractFilter
    search_fields = ["reference", "employee__matricule", "employee__last_name", "employee__first_name"]
    ordering_fields = ["start_date", "end_date", "reference", "created_at"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    serializer_classes = {
        "list": ContractListSerializer,
        "expiring": ContractListSerializer,
        "renew": RenewSerializer,
        "activate": ActivateSerializer,
        "terminate": TerminateContractSerializer,
        "history": ContractHistorySerializer,
        "documents": ContractDocumentSerializer,
        "document": ContractDocumentSerializer,
    }

    def get_serializer_class(self):
        return self.serializer_classes.get(self.action, ContractSerializer)

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Contract.objects.none()
        queryset = Contract.objects.select_related(
            "employee", "contract_type", "position", "renewed_by"
        )
        user = self.request.user
        if user.role in (Role.ADMIN, Role.HR):
            return queryset
        # Object-level access: own contracts only, drafts (internal proposals) excluded.
        return queryset.filter(employee__user=user).exclude(status=ContractStatus.DRAFT)

    def perform_create(self, serializer):
        serializer.instance = services.create_contract(
            data=serializer.validated_data, actor=self.request.user, request=self.request
        )

    def perform_update(self, serializer):
        serializer.instance = services.update_contract(
            contract=serializer.instance,
            data=serializer.validated_data,
            actor=self.request.user,
            request=self.request,
        )

    def perform_destroy(self, instance):
        services.delete_contract(contract=instance, actor=self.request.user, request=self.request)

    # --- Lifecycle ----------------------------------------------------------
    @extend_schema(request=ActivateSerializer, responses=ContractSerializer)
    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        """Sign a draft: it becomes ACTIVE (and closes the contract it renews)."""
        contract = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        contract = services.activate(
            contract=contract,
            signed_date=serializer.validated_data["signed_date"],
            actor=request.user,
            request=request,
        )
        return Response(ContractSerializer(contract).data)

    @extend_schema(request=RenewSerializer, responses={201: ContractSerializer})
    @action(detail=True, methods=["post"])
    def renew(self, request, pk=None):
        """Create the draft successor of a running contract (history is preserved)."""
        contract = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        successor = services.renew(
            contract=contract, data=serializer.validated_data, actor=request.user, request=request
        )
        return Response(ContractSerializer(successor).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=TerminateContractSerializer, responses=ContractSerializer)
    @action(detail=True, methods=["post"])
    def terminate(self, request, pk=None):
        """Early termination of a running contract."""
        contract = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        contract = services.terminate(
            contract=contract,
            end_date=serializer.validated_data["end_date"],
            actor=request.user,
            request=request,
        )
        return Response(ContractSerializer(contract).data)

    # --- Alerts ---------------------------------------------------------------
    @extend_schema(
        parameters=[OpenApiParameter("days", OpenApiTypes.INT, required=False)],
        responses=ContractListSerializer(many=True),
    )
    @action(detail=False, methods=["get"], permission_classes=[IsAdminOrHR])
    def expiring(self, request):
        """Running contracts ending within `days` days (default: CONTRACT_ALERT_DAYS), overdue ones included."""
        limit = timezone.localdate() + timedelta(days=_alert_days(request))
        queryset = self.get_queryset().filter(
            status=ContractStatus.ACTIVE, end_date__isnull=False, end_date__lte=limit
        ).order_by("end_date")
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response(ContractListSerializer(page, many=True).data)

    # --- History (audit) ---------------------------------------------------------
    @extend_schema(responses=ContractHistorySerializer(many=True))
    @action(detail=True, methods=["get"], permission_classes=[IsAdminOrHR])
    def history(self, request, pk=None):
        """Audit trail of this contract: who did what, and when (no values, no salary)."""
        contract = self.get_object()
        entries = AuditLog.objects.filter(
            target_type=Contract._meta.label_lower, target_id=str(contract.pk)
        )
        page = self.paginate_queryset(entries)
        return self.get_paginated_response(ContractHistorySerializer(page, many=True).data)

    # --- Documents ----------------------------------------------------------------
    @extend_schema(methods=["GET"], request=None, responses=ContractDocumentSerializer(many=True))
    @extend_schema(
        methods=["POST"],
        request={"multipart/form-data": ContractDocumentUploadSerializer},
        responses={201: ContractDocumentSerializer},
    )
    @action(detail=True, methods=["get", "post"], parser_classes=[MultiPartParser])
    def documents(self, request, pk=None):
        """GET: list the documents. POST: attach a PDF (ADMIN / HR)."""
        contract = self.get_object()
        if request.method == "GET":
            return Response(ContractDocumentSerializer(contract.documents.all(), many=True).data)

        serializer = ContractDocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        document = services.add_document(
            contract=contract, actor=request.user, request=request, **serializer.validated_data
        )
        return Response(ContractDocumentSerializer(document).data, status=status.HTTP_201_CREATED)

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
        """GET: download (permission checked on every read). DELETE: ADMIN only."""
        contract = self.get_object()
        document = get_object_or_404(contract.documents, pk=document_id)

        if request.method == "GET":
            response = FileResponse(
                document.file.open("rb"),
                content_type="application/pdf",
                as_attachment=True,
                filename=f"{contract.reference}-{document.pk}.pdf",
            )
            response["Cache-Control"] = "private, no-cache"
            return response

        if request.user.role != Role.ADMIN:
            raise PermissionDenied("Seul un administrateur peut supprimer un document de contrat.")
        services.remove_document(document=document, actor=request.user, request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)