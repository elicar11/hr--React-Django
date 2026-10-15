from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("contract-types", views.ContractTypeViewSet, basename="contract-type")
router.register("contracts", views.ContractViewSet, basename="contract")

urlpatterns = router.urls