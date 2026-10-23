from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminOrHR
from apps.attendance.serializers import (
    AttendanceCorrectionSerializer,
    AttendanceRecordSerializer,
    WorkScheduleSerializer,
)
from apps.employees.serializers import EmployeeListSerializer
from apps.leaves.serializers import LeaveBalanceSerializer, LeaveRequestSerializer
from apps.payroll.serializers import PayslipListSerializer

from . import services
from .serializers import DashboardQuerySerializer


class HRDashboardView(APIView):
    """HR indicators computed from the database (ADMIN / HR)."""

    permission_classes = [IsAdminOrHR]

    @extend_schema(parameters=[DashboardQuerySerializer], responses=OpenApiTypes.OBJECT)
    def get(self, request):
        query = DashboardQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        return Response(services.hr_dashboard(user=request.user, **query.validated_data))


class EmployeeDashboardView(APIView):
    """Personal dashboard of the connected employee (own data only)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        data = services.employee_dashboard(user=request.user)
        overview = data["today"]
        schedule, record = overview["schedule"], overview["record"]
        payslip = data["latest_payslip"]
        next_leave = data["next_leave"]
        return Response(
            {
                "employee": EmployeeListSerializer(data["employee"]).data,
                "today": {
                    "date": overview["date"].isoformat(),
                    "is_working_day": overview["is_working_day"],
                    "schedule": WorkScheduleSerializer(schedule).data if schedule else None,
                    "record": AttendanceRecordSerializer(record).data if record else None,
                },
                "leave_balances": LeaveBalanceSerializer(data["leave_balances"], many=True).data,
                "pending_leave_requests": data["pending_leave_requests"],
                "next_leave": LeaveRequestSerializer(next_leave).data if next_leave else None,
                "latest_payslip": PayslipListSerializer(payslip).data if payslip else None,
                "recent_leave_requests": LeaveRequestSerializer(data["recent_leave_requests"], many=True).data,
                "recent_corrections": AttendanceCorrectionSerializer(data["recent_corrections"], many=True).data,
            }
        )