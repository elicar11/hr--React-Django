from rest_framework import serializers

from apps.core.fields import CodeField
from apps.employees.models import Employee

from .models import (
    AttendanceCorrection,
    AttendanceRecord,
    AttendanceStatus,
    Holiday,
    ScheduleAssignment,
    WorkSchedule,
)


class WorkScheduleSerializer(serializers.ModelSerializer):
    code = CodeField()
    working_days = serializers.ListField(
        child=serializers.IntegerField(min_value=0, max_value=6), allow_empty=False
    )

    class Meta:
        model = WorkSchedule
        fields = [
            "id", "code", "name", "start_time", "end_time", "break_start", "break_end",
            "working_days", "late_grace_minutes", "overtime_threshold_minutes",
            "is_default", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "is_default", "created_at", "updated_at"]

    def validate_code(self, value):
        queryset = WorkSchedule.objects.filter(code__iexact=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("Ce code est déjà utilisé.")
        return value

    def validate_working_days(self, value):
        return sorted(set(value))

    def validate(self, attrs):
        def current(name):
            return attrs.get(name, getattr(self.instance, name, None))

        start, end = current("start_time"), current("end_time")
        break_start, break_end = current("break_start"), current("break_end")
        if start and end and end <= start:
            raise serializers.ValidationError({"end_time": "L'heure de fin doit suivre l'heure de début."})
        if (break_start is None) != (break_end is None):
            raise serializers.ValidationError("Renseignez le début et la fin de la pause, ou aucun des deux.")
        if break_start is not None:
            if break_end <= break_start:
                raise serializers.ValidationError({"break_end": "La fin de pause doit suivre son début."})
            if start and end and not (start <= break_start and break_end <= end):
                raise serializers.ValidationError("La pause doit être comprise dans les heures de travail.")
        return attrs


class ScheduleAssignmentSerializer(serializers.ModelSerializer):
    employee_matricule = serializers.CharField(source="employee.matricule", read_only=True)
    schedule_code = serializers.CharField(source="schedule.code", read_only=True)

    class Meta:
        model = ScheduleAssignment
        fields = [
            "id", "employee", "employee_matricule", "schedule", "schedule_code",
            "start_date", "end_date",
        ]
        read_only_fields = ["id", "end_date"]


class HolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Holiday
        fields = ["id", "date", "name"]
        read_only_fields = ["id"]


class AttendanceRecordSerializer(serializers.ModelSerializer):
    employee_matricule = serializers.CharField(source="employee.matricule", read_only=True)
    employee_name = serializers.SerializerMethodField()
    department_name = serializers.CharField(source="employee.department.name", read_only=True)
    schedule_code = serializers.CharField(source="schedule.code", read_only=True, allow_null=True)

    class Meta:
        model = AttendanceRecord
        fields = [
            "id", "employee", "employee_matricule", "employee_name", "department_name",
            "date", "status", "source", "check_in", "check_out",
            "worked_minutes", "late_minutes", "overtime_minutes",
            "absence_reason", "schedule", "schedule_code", "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_employee_name(self, obj) -> str:
        return f"{obj.employee.last_name} {obj.employee.first_name}"


class AttendanceWriteSerializer(serializers.Serializer):
    """Input of the manual record creation / correction by ADMIN / HR."""

    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.all())
    date = serializers.DateField()
    status = serializers.ChoiceField(choices=AttendanceStatus.choices)
    check_in = serializers.DateTimeField(required=False, allow_null=True)
    check_out = serializers.DateTimeField(required=False, allow_null=True)
    absence_reason = serializers.CharField(max_length=255, required=False, allow_blank=True)


class AttendanceSummarySerializer(serializers.Serializer):
    employee_id = serializers.IntegerField()
    matricule = serializers.CharField()
    last_name = serializers.CharField()
    first_name = serializers.CharField()
    days_present = serializers.IntegerField()
    days_absent_justified = serializers.IntegerField()
    days_absent_unjustified = serializers.IntegerField()
    late_count = serializers.IntegerField()
    total_late_minutes = serializers.IntegerField()
    total_worked_minutes = serializers.IntegerField()
    total_overtime_minutes = serializers.IntegerField()


class AttendanceCorrectionSerializer(serializers.ModelSerializer):
    employee_matricule = serializers.CharField(source="employee.matricule", read_only=True)
    employee_name = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceCorrection
        fields = [
            "id", "employee", "employee_matricule", "employee_name", "date",
            "check_in", "check_out", "reason", "status",
            "requested_by", "decided_by", "decided_at", "decision_comment", "created_at",
        ]
        read_only_fields = fields

    def get_employee_name(self, obj) -> str:
        return f"{obj.employee.last_name} {obj.employee.first_name}"


class CorrectionRequestSerializer(serializers.Serializer):
    date = serializers.DateField()
    check_in = serializers.DateTimeField()
    check_out = serializers.DateTimeField(required=False, allow_null=True)
    reason = serializers.CharField(max_length=500)


class DecisionSerializer(serializers.Serializer):
    comment = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")


class RejectSerializer(serializers.Serializer):
    comment = serializers.CharField(max_length=500)