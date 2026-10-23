from datetime import date

from django.utils import timezone
from rest_framework import serializers

from apps.employees.models import EmploymentStatus
from apps.organization.models import Department

MAX_WINDOW_MONTHS = 36


class DashboardQuerySerializer(serializers.Serializer):
    """Filters of the HR dashboard. Defaults: the last 12 months, employees not yet left."""

    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all(), required=False)
    status = serializers.ChoiceField(choices=EmploymentStatus.choices, required=False)

    def validate(self, attrs):
        today = timezone.localdate()
        date_to = attrs.get("date_to") or today
        if "date_from" in attrs:
            date_from = attrs["date_from"]
        else:  # first day of the month, 11 months before date_to
            months = date_to.year * 12 + date_to.month - 1 - 11
            date_from = date(months // 12, months % 12 + 1, 1)
        if date_from > date_to:
            raise serializers.ValidationError({"date_to": "La fin de période doit suivre son début."})
        span = (date_to.year - date_from.year) * 12 + date_to.month - date_from.month + 1
        if span > MAX_WINDOW_MONTHS:
            raise serializers.ValidationError(f"La période ne peut pas dépasser {MAX_WINDOW_MONTHS} mois.")
        attrs["date_from"], attrs["date_to"] = date_from, date_to
        return attrs