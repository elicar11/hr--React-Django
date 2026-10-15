from django.conf import settings

from .models import AuditLog


def get_client_ip(request):
    """Best-effort client IP.

    X-Forwarded-For is only trusted when TRUSTED_PROXY_COUNT > 0
    (number of reverse proxies in front of Django), otherwise it can be spoofed.
    """
    if request is None:
        return None
    proxies = settings.TRUSTED_PROXY_COUNT
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if proxies and forwarded:
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        if len(parts) >= proxies:
            return parts[-proxies]
    return request.META.get("REMOTE_ADDR") or None


def record(*, action, actor=None, request=None, target=None, metadata=None):
    """Write an audit entry.

    Call it inside the same transaction as the operation it documents, so that
    an operation can never succeed without its audit trail.
    """
    if actor is None and request is not None:
        user = getattr(request, "user", None)
        if user is not None and user.is_authenticated:
            actor = user

    return AuditLog.objects.create(
        actor=actor,
        actor_email=actor.email if actor else "",
        action=action,
        target_type=target._meta.label_lower if target is not None else "",
        target_id=str(target.pk) if target is not None else "",
        metadata=metadata or {},
        ip_address=get_client_ip(request),
    )