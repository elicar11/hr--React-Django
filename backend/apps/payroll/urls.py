from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views

router = SimpleRouter()
router.register("pay-item-types", views.PayItemTypeViewSet, basename="pay-item-type")
router.register("pay-elements", views.EmployeePayItemViewSet, basename="pay-element")
router.register("payroll-periods", views.PayrollPeriodViewSet, basename="payroll-period")
router.register("payslips", views.PayslipViewSet, basename="payslip")

urlpatterns = [
    path("payroll-settings/", views.PayrollSettingsView.as_view(), name="payroll-settings"),
    *router.urls,
]