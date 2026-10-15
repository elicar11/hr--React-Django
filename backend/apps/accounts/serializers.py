from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from . import services
from .models import User


class UserSerializer(serializers.ModelSerializer):
    """Read / update representation. is_active changes via dedicated endpoints."""

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name", "role",
            "is_active", "last_login", "date_joined",
        ]
        read_only_fields = ["id", "is_active", "last_login", "date_joined"]

    def validate_email(self, value):
        value = value.lower()
        qs = User.objects.filter(email__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Un utilisateur avec cet e-mail existe déjà.")
        return value


class UserCreateSerializer(UserSerializer):
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    class Meta(UserSerializer.Meta):
        fields = ["id", "email", "first_name", "last_name", "role", "password"]
        read_only_fields = ["id"]

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class LoginSerializer(TokenObtainPairSerializer):
    """Adds the user profile to the login response."""

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_old_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Le mot de passe actuel est incorrect.")
        return value

    def validate_new_password(self, value):
        validate_password(value, user=self.context["request"].user)
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = services.get_user_from_reset_link(attrs["uid"], attrs["token"])
        if user is None:
            raise serializers.ValidationError(
                {"token": "Ce lien de réinitialisation est invalide ou a expiré."}
            )
        try:
            validate_password(attrs["new_password"], user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"new_password": list(exc.messages)})
        attrs["user"] = user
        return attrs