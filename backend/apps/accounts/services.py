import logging

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.db import transaction
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from apps.core import audit
from apps.core.models import AuditAction

from .models import User

logger = logging.getLogger(__name__)


def revoke_user_tokens(user):
    """Blacklist every outstanding refresh token of the user."""
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)


@transaction.atomic
def set_user_active(*, actor, user, is_active, request=None):
    """Activate or deactivate an account. Deactivation revokes all sessions."""
    if user.pk == actor.pk and not is_active:
        raise ValidationError("Vous ne pouvez pas désactiver votre propre compte.")
    user.is_active = is_active
    user.save(update_fields=["is_active", "updated_at"])
    if not is_active:
        revoke_user_tokens(user)
    audit.record(
        action=AuditAction.USER_ACTIVATED if is_active else AuditAction.USER_DEACTIVATED,
        actor=actor,
        request=request,
        target=user,
    )
    # Log identifiers only, never personal data or credentials.
    logger.info("user_active_changed actor=%s target=%s is_active=%s", actor.pk, user.pk, is_active)
    return user


@transaction.atomic
def change_password(*, user, new_password, request=None):
    """Set a new password and force re-login everywhere."""
    user.set_password(new_password)
    user.save(update_fields=["password", "updated_at"])
    revoke_user_tokens(user)
    audit.record(action=AuditAction.PASSWORD_CHANGED, actor=user, request=request, target=user)
    logger.info("password_changed user=%s", user.pk)


# --- Password reset by e-mail ------------------------------------------------
# Tokens come from Django's PasswordResetTokenGenerator: they are bound to the
# current password hash (so single-use) and expire after PASSWORD_RESET_TIMEOUT.


def _send_reset_email(user, uid, token):
    link = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?uid={uid}&token={token}"
    minutes = settings.PASSWORD_RESET_TIMEOUT // 60
    body = (
        f"Bonjour {user.first_name},\n\n"
        "Une réinitialisation de votre mot de passe a été demandée.\n"
        f"Cliquez sur le lien suivant pour choisir un nouveau mot de passe :\n\n{link}\n\n"
        f"Ce lien est valable {minutes} minutes et ne peut être utilisé qu'une seule fois.\n"
        "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : "
        "votre mot de passe reste inchangé.\n"
    )
    send_mail(
        subject="Réinitialisation de votre mot de passe",
        message=body,
        from_email=None,  # DEFAULT_FROM_EMAIL
        recipient_list=[user.email],
        fail_silently=False,
    )


def request_password_reset(*, email, request=None):
    """Send a reset link if an active account matches. Never reveals whether it exists."""
    user = User.objects.filter(email__iexact=email, is_active=True).first()
    if user is None:
        return
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    try:
        _send_reset_email(user, uid, token)
    except Exception:
        # The API answer stays generic; the failure is logged without the link.
        logger.exception("password_reset_email_failed user=%s", user.pk)
        return
    audit.record(action=AuditAction.PASSWORD_RESET_REQUESTED, request=request, target=user)
    logger.info("password_reset_requested user=%s", user.pk)


def get_user_from_reset_link(uid, token):
    """Return the active user matching a valid, unexpired reset link, else None."""
    try:
        pk = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=pk, is_active=True)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return None
    return user if default_token_generator.check_token(user, token) else None


@transaction.atomic
def confirm_password_reset(*, user, new_password, request=None):
    user.set_password(new_password)
    user.save(update_fields=["password", "updated_at"])
    revoke_user_tokens(user)
    audit.record(action=AuditAction.PASSWORD_RESET_COMPLETED, actor=user, request=request, target=user)
    logger.info("password_reset_completed user=%s", user.pk)