from rest_framework import serializers

from apps.core.fields import CodeField

from . import services
from .models import Department, Position


class UniqueCodeMixin:
    """Case-insensitive uniqueness check for the `code` field (already uppercased by CodeField)."""

    def validate_code(self, value):
        queryset = self.Meta.model.objects.filter(code__iexact=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("Ce code est déjà utilisé.")
        return value


class DepartmentSerializer(UniqueCodeMixin, serializers.ModelSerializer):
    code = CodeField()
    parent_name = serializers.CharField(source="parent.name", read_only=True, allow_null=True)
    children_count = serializers.SerializerMethodField()
    positions_count = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = [
            "id", "code", "name", "description", "parent", "parent_name",
            "is_active", "children_count", "positions_count", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "is_active", "created_at", "updated_at"]

    def get_children_count(self, obj) -> int:
        value = getattr(obj, "children_count", None)  # annotated by the viewset
        return value if value is not None else obj.children.count()

    def get_positions_count(self, obj) -> int:
        value = getattr(obj, "positions_count", None)
        return value if value is not None else obj.positions.count()

    def validate_parent(self, value):
        if value is None:
            return value
        if not value.is_active:
            raise serializers.ValidationError("Le département parent doit être actif.")
        if self.instance and services.would_create_cycle(self.instance, value):
            raise serializers.ValidationError(
                "Ce parent créerait une boucle dans la hiérarchie des départements."
            )
        return value


class PositionSerializer(UniqueCodeMixin, serializers.ModelSerializer):
    code = CodeField()
    department_name = serializers.CharField(source="department.name", read_only=True, allow_null=True)

    class Meta:
        model = Position
        fields = [
            "id", "code", "title", "description", "level", "department",
            "department_name", "is_active", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "is_active", "created_at", "updated_at"]

    def validate_department(self, value):
        if value is not None and not value.is_active:
            raise serializers.ValidationError("Le département associé doit être actif.")
        return value