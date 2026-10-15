from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("audit-logs", views.AuditLogViewSet, basename="audit-log")

urlpatterns = router.urls