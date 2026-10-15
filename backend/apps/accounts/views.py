from django.conf import settings
from django.db import transaction
from django_filters import rest_framework as filters
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.core import audit
from apps.core.models import AuditAction

from . import services
from .models import User
from .permissions import IsAdmin
from .serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    UserCreateSerializer,
    UserSerializer,
)

COOKIE_PATH = "/api/v1/auth/"


def _set_refresh_cookie(response, refresh_token):
    lifetime = settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"]
    response.set_cookie(
        settings.AUTH_REFRESH_COOKIE_NAME,
        str(refresh_token),
        max_age=int(lifetime.total_seconds()),
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        path=COOKIE_PATH,
    )


def _clear_refresh_cookie(response):
    response.delete_cookie(
        settings.AUTH_REFRESH_COOKIE_NAME,
        path=COOKIE_PATH,
        samesite=settings.AUTH_COOKIE_SAMESITE,
    )


class LoginView(TokenObtainPairView):
    """Returns the access token in the body; the refresh token goes in an HttpOnly cookie."""

    serializer_class = LoginSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except AuthenticationFailed:
            attempted = request.data.get("email", "") if isinstance(request.data, dict) else ""
            # The password is never recorded, only the e-mail that was tried.
            audit.record(
                action=AuditAction.LOGIN_FAILED,
                request=request,
                metadata={"email": str(attempted).strip().lower()[:254]},
            )
            raise
        except TokenError as exc:
            raise InvalidToken(exc.args[0])

        data = serializer.validated_data
        refresh = data.pop("refresh")
        audit.record(action=AuditAction.LOGIN, actor=serializer.user, request=request)
        response = Response(data, status=status.HTTP_200_OK)
        _set_refresh_cookie(response, refresh)
        return response


class CookieRefreshView(TokenRefreshView):
    """Issues a new access token from the refresh cookie (with rotation)."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "refresh"

    def post(self, request, *args, **kwargs):
        token = request.COOKIES.get(settings.AUTH_REFRESH_COOKIE_NAME)
        if not token:
            raise AuthenticationFailed("Session expirée.", code="session_expired")
        serializer = self.get_serializer(data={"refresh": token})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            raise InvalidToken(exc.args[0])
        data = serializer.validated_data
        response = Response({"access": data["access"]})
        if "refresh" in data:  # rotation enabled
            _set_refresh_cookie(response, data["refresh"])
        return response


class LogoutView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        token = request.COOKIES.get(settings.AUTH_REFRESH_COOKIE_NAME)
        if token:
            try:
                refresh = RefreshToken(token)
                refresh.blacklist()
                actor = User.objects.filter(pk=refresh["user_id"]).first()
                audit.record(action=AuditAction.LOGOUT, actor=actor, request=request)
            except TokenError:
                pass  # already invalid: nothing to revoke
        response = Response(status=status.HTTP_204_NO_CONTENT)
        _clear_refresh_cookie(response)
        return response


class MeView(generics.RetrieveAPIView):
    """Profile of the connected user."""

    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class ChangePasswordView(generics.GenericAPIView):
    serializer_class = ChangePasswordSerializer

    @extend_schema(responses={204: None})
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.change_password(
            user=request.user,
            new_password=serializer.validated_data["new_password"],
            request=request,
        )
        response = Response(status=status.HTTP_204_NO_CONTENT)
        _clear_refresh_cookie(response)
        return response


class PasswordResetRequestView(generics.GenericAPIView):
    """Always answers the same message, whether the account exists or not."""

    serializer_class = PasswordResetRequestSerializer
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    @extend_schema(responses={200: None})
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.request_password_reset(email=serializer.validated_data["email"], request=request)
        return Response(
            {
                "detail": "Si un compte actif correspond à cette adresse, "
                "un e-mail de réinitialisation vient d'être envoyé."
            }
        )


class PasswordResetConfirmView(generics.GenericAPIView):
    serializer_class = PasswordResetConfirmSerializer
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset_confirm"

    @extend_schema(responses={200: None})
    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.confirm_password_reset(
            user=serializer.validated_data["user"],
            new_password=serializer.validated_data["new_password"],
            request=request,
        )
        return Response({"detail": "Votre mot de passe a été réinitialisé. Vous pouvez vous connecter."})


class UserFilter(filters.FilterSet):
    class Meta:
        model = User
        fields = {"role": ["exact"], "is_active": ["exact"]}


class UserViewSet(viewsets.ModelViewSet):
    """User management, restricted to administrators. No hard delete."""

    queryset = User.objects.all()
    permission_classes = [IsAdmin]
    filterset_class = UserFilter
    search_fields = ["email", "first_name", "last_name"]
    ordering_fields = ["last_name", "first_name", "email", "date_joined"]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_serializer_class(self):
        return UserCreateSerializer if self.action == "create" else UserSerializer

    @transaction.atomic
    def perform_create(self, serializer):
        user = serializer.save()
        audit.record(
            action=AuditAction.USER_CREATED,
            request=self.request,
            target=user,
            metadata={"role": user.role},
        )

    @transaction.atomic
    def perform_update(self, serializer):
        instance = serializer.instance
        new_role = serializer.validated_data.get("role")
        if instance.pk == self.request.user.pk and new_role not in (None, instance.role):
            raise ValidationError({"role": "Vous ne pouvez pas modifier votre propre rôle."})

        # Only field names are audited, never their values (except the role change).
        changed = [f for f, v in serializer.validated_data.items() if getattr(instance, f) != v]
        old_role = instance.role
        user = serializer.save()
        if changed:
            metadata = {"fields": changed}
            if "role" in changed:
                metadata["role"] = {"from": old_role, "to": user.role}
            audit.record(
                action=AuditAction.USER_UPDATED,
                request=self.request,
                target=user,
                metadata=metadata,
            )

    @extend_schema(request=None, responses=UserSerializer)
    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        user = services.set_user_active(
            actor=request.user, user=self.get_object(), is_active=False, request=request
        )
        return Response(UserSerializer(user).data)

    @extend_schema(request=None, responses=UserSerializer)
    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        user = services.set_user_active(
            actor=request.user, user=self.get_object(), is_active=True, request=request
        )
        return Response(UserSerializer(user).data)