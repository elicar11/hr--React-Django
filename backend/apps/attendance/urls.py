from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("work-schedules", views.WorkScheduleViewSet, basename="work-schedule")
router.register("schedule-assignments", views.ScheduleAssignmentViewSet, basename="schedule-assignment")
router.register("holidays", views.HolidayViewSet, basename="holiday")
router.register("attendance-corrections", views.AttendanceCorrectionViewSet, basename="attendance-correction")
router.register("attendance", views.AttendanceViewSet, basename="attendance")

urlpatterns = router.urls