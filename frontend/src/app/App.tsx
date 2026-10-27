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
                        <Route path="attendance/*" element={soon("Présences", "F8")} />
                        <Route path="leaves/*" element={soon("Congés", "F9")} />
                        <Route path="calendar" element={soon("Calendrier RH", "F9")} />
                        <Route path="payroll/*" element={soon("Paie", "F10")} />
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