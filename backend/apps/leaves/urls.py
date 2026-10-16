from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("leave-types", views.LeaveTypeViewSet, basename="leave-type")
router.register("leave-balances", views.LeaveBalanceViewSet, basename="leave-balance")
router.register("leave-requests", views.LeaveRequestViewSet, basename="leave-request")

urlpatterns = router.urls