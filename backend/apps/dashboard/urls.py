from django.urls import path

from . import views

urlpatterns = [
    path("dashboard/", views.HRDashboardView.as_view(), name="dashboard"),
    path("dashboard/employee/", views.EmployeeDashboardView.as_view(), name="dashboard-employee"),
]