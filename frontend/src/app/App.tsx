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
                    <Route index element={soon("Tableau de bord", "F4")} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="my/*" element={soon("Mon espace", "F12")} />

                    <Route element={<RequireRole roles={STAFF} />}>
                        <Route path="departments/*" element={soon("Départements", "F5")} />
                        <Route path="positions/*" element={soon("Postes", "F5")} />
                        <Route path="employees/*" element={soon("Employés", "F6")} />
                        <Route path="contracts/*" element={soon("Contrats", "F7")} />
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