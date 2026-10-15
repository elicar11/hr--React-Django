from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("departments", views.DepartmentViewSet, basename="department")
router.register("positions", views.PositionViewSet, basename="position")

urlpatterns = router.urls