import logging

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.db.models import ProtectedError, RestrictedError
from rest_framework.exceptions import APIException, Throttled, ValidationError
from rest_framework.response import Response
from rest_framework.serializers import as_serializer_error
from rest_framework.views import exception_handler as drf_exception_handler
from rest_framework.views import set_rollback

logger = logging.getLogger(__name__)

STATUS_CODES = {
    400: "bad_request",
    401: "not_authenticated",
    403: "permission_denied",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    415: "unsupported_media_type",
    429: "throttled",
}

GENERIC_MESSAGES = {
    400: "Requête invalide.",
    401: "Authentification requise.",
    403: "Vous n'avez pas les droits nécessaires pour cette opération.",
    404: "Ressource introuvable.",
    405: "Méthode non autorisée.",
    409: "Cette opération est en conflit avec l'état actuel des données.",
    429: "Trop de requêtes. Veuillez réessayer plus tard.",
    500: "Une erreur interne est survenue. Veuillez réessayer plus tard.",
}


class Conflict(APIException):
    status_code = 409
    default_detail = "Cette opération est en conflit avec l'état actuel des données."
    default_code = "conflict"


def build_error(*, code, message, status_code, details=None):
    """Single JSON shape for every error returned by the API."""
    error = {"code": code, "message": message, "status": status_code}
    if details is not None:
        error["details"] = details
    return {"error": error}


def custom_exception_handler(exc, context):
    view_name = context["view"].__class__.__name__ if context.get("view") else "unknown"

    # Translate Django-level exceptions into DRF ones.
    if isinstance(exc, DjangoValidationError):
        exc = ValidationError(as_serializer_error(exc))
    elif isinstance(exc, (ProtectedError, RestrictedError)):
        exc = Conflict(
            "Suppression impossible : cet élément est référencé par d'autres données."
        )
    elif isinstance(exc, IntegrityError):
        # Do not log the DB message: it may contain personal data.
        logger.warning("integrity_error view=%s", view_name)
        exc = Conflict()

    response = drf_exception_handler(exc, context)

    if response is None:  # unhandled exception -> 500
        logger.error("unhandled_exception view=%s", view_name, exc_info=exc)
        set_rollback()
        return Response(
            build_error(code="server_error", message=GENERIC_MESSAGES[500], status_code=500),
            status=500,
        )

    data = response.data
    details = None

    if isinstance(exc, ValidationError):
        code = "validation_error"
        message = "Les données envoyées sont invalides."
        details = data
    else:
        if isinstance(exc, APIException):
            codes = exc.get_codes()
            code = codes if isinstance(codes, str) else exc.default_code
        else:  # Http404 / Django PermissionDenied converted by DRF
            code = STATUS_CODES.get(response.status_code, "error")

        if isinstance(data, dict) and "detail" in data:
            message = str(data["detail"])
        else:
            message = GENERIC_MESSAGES.get(response.status_code, "Une erreur est survenue.")

        if isinstance(exc, Throttled) and exc.wait is not None:
            details = {"retry_after": int(exc.wait)}

    response.data = build_error(
        code=code, message=message, status_code=response.status_code, details=details
    )
    return response