import { Route, Routes } from "react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { ForgotPasswordPage } from "@/modules/auth/pages/ForgotPasswordPage";
import { LoginPage } from "@/modules/auth/pages/LoginPage";
import { ProfilePage } from "@/modules/auth/pages/ProfilePage";
import { ResetPasswordPage } from "@/modules/auth/pages/ResetPasswordPage";
import { GuestOnly, RequireAuth, RequireRole } from "@/modules/auth/RouteGuards";
import type { Role } from "@/modules/auth/types";
import { ComingSoonPage } from "@/modules/core/pages/ComingSoonPage";
import { NotFoundPage } from "@/modules/core/pages/NotFoundPage";
import { UiKitPage } from "@/modules/core/pages/UiKitPage";
import { DashboardPage } from "@/modules/dashboard/pages/DashboardPage";
import { EmployeeDetailPage } from "@/modules/employees/pages/EmployeeDetailPage";
import { EmployeeFormPage } from "@/modules/employees/pages/EmployeeFormPage";
import { EmployeesPage } from "@/modules/employees/pages/EmployeesPage";
import { DepartmentsPage } from "@/modules/organization/pages/DepartmentsPage";
import { PositionsPage } from "@/modules/organization/pages/PositionsPage";
import { ContractDetailPage } from "@/modules/contracts/pages/ContractDetailPage";
import { ContractFormPage } from "@/modules/contracts/pages/ContractFormPage";
import { ContractsPage } from "@/modules/contracts/pages/ContractsPage";
import { ContractTypesPage } from "@/modules/contracts/pages/ContractTypesPage";
import { AttendancePage } from "@/modules/attendance/pages/AttendancePage";
import { HolidaysPage } from "@/modules/attendance/pages/HolidaysPage";
import { MyAttendancePage } from "@/modules/attendance/pages/MyAttendancePage";
import { WorkSchedulesPage } from "@/modules/attendance/pages/WorkSchedulesPage";
import { LeaveBalancesPage } from "@/modules/leaves/pages/LeaveBalancesPage";
import { LeaveCalendarPage } from "@/modules/leaves/pages/LeaveCalendarPage";
import { LeaveDetailPage } from "@/modules/leaves/pages/LeaveDetailPage";
import { LeavesPage } from "@/modules/leaves/pages/LeavesPage";
import { LeaveTypesPage } from "@/modules/leaves/pages/LeaveTypesPage";
import { MyLeavesPage } from "@/modules/leaves/pages/MyLeavesPage";
import { MyPayslipsPage } from "@/modules/payroll/pages/MyPayslipsPage";
import { PayElementsPage } from "@/modules/payroll/pages/PayElementsPage";
import { PayItemTypesPage } from "@/modules/payroll/pages/PayItemTypesPage";
import { PayrollPage } from "@/modules/payroll/pages/PayrollPage";
import { PayrollSettingsPage } from "@/modules/payroll/pages/PayrollSettingsPage";
import { PayslipDetailPage } from "@/modules/payroll/pages/PayslipDetailPage";
import { PeriodDetailPage } from "@/modules/payroll/pages/PeriodDetailPage";

const STAFF: readonly Role[] = ["ADMIN", "HR"];
const ADMIN_ONLY: readonly Role[] = ["ADMIN"];

/** Sections not built yet show an explicit state; each one is replaced by its real page. */
const soon = (title: string, step: string) => <ComingSoonPage title={title} step={step} />;

export function App() {
    return (
        <Routes>
            {/* Public pages */}
            <Route element={<GuestOnly />}>
                <Route path="login" element={<LoginPage />} />
            </Route>
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />

            {/* Authenticated area */}
            <Route element={<RequireAuth />}>
                <Route element={<AppLayout />}>
                    <Route index element={<DashboardPage />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="my/attendance" element={<MyAttendancePage />} />
                    <Route path="leaves/:id" element={<LeaveDetailPage />} />
                    <Route path="my/leaves" element={<MyLeavesPage />} />
                    <Route path="my/payslips" element={<MyPayslipsPage />} />
                    <Route path="my/payslips/:id" element={<PayslipDetailPage />} />
                    <Route path="my/*" element={soon("Mon espace", "F12")} />

                    <Route element={<RequireRole roles={STAFF} />}>
                        <Route path="departments" element={<DepartmentsPage />} />
                        <Route path="positions" element={<PositionsPage />} />
                        <Route path="employees" element={<EmployeesPage />} />
                        <Route path="employees/new" element={<EmployeeFormPage />} />
                        <Route path="employees/:id" element={<EmployeeDetailPage />} />
                        <Route path="employees/:id/edit" element={<EmployeeFormPage />} />
                        <Route path="contracts" element={<ContractsPage />} />
                        <Route path="contracts/new" element={<ContractFormPage />} />
                        <Route path="contracts/:id" element={<ContractDetailPage />} />
                        <Route path="contracts/:id/edit" element={<ContractFormPage />} />
                        <Route path="contract-types" element={<ContractTypesPage />} />
                        <Route path="attendance" element={<AttendancePage />} />
                        <Route path="work-schedules" element={<WorkSchedulesPage />} />
                        <Route path="holidays" element={<HolidaysPage />} />
                        <Route path="leaves" element={<LeavesPage />} />
                        <Route path="calendar" element={<LeaveCalendarPage />} />
                        <Route path="leave-balances" element={<LeaveBalancesPage />} />
                        <Route path="leave-types" element={<LeaveTypesPage />} />
                        <Route path="payroll" element={<PayrollPage />} />
                        <Route path="payroll/periods/:id" element={<PeriodDetailPage />} />
                        <Route path="payroll/payslips/:id" element={<PayslipDetailPage />} />
                        <Route path="payroll/item-types" element={<PayItemTypesPage />} />
                        <Route path="payroll/elements" element={<PayElementsPage />} />
                        <Route path="payroll/settings" element={<PayrollSettingsPage />} />
                        <Route path="settings/*" element={soon("Paramètres", "F11")} />
                    </Route>

                    <Route element={<RequireRole roles={ADMIN_ONLY} />}>
                        <Route path="users/*" element={soon("Utilisateurs et rôles", "F11")} />
                        <Route path="audit" element={soon("Journal d'audit", "F11")} />
                    </Route>

                    {import.meta.env.DEV && <Route path="ui-kit" element={<UiKitPage />} />}
                    <Route path="*" element={<NotFoundPage />} />
                </Route>
            </Route>
        </Routes>
    );
}