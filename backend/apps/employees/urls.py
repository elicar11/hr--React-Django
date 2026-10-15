from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("employees", views.EmployeeViewSet, basename="employee")

urlpatterns = router.urls