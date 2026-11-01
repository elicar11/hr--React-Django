import { FullPageSpinner } from "@/components/layout/FullPageSpinner";
import { useAuth } from "@/modules/auth/authContext";
import { RequireAuth } from "@/modules/auth/RouteGuards";
import { LandingPage } from "./pages/LandingPage";
import { useLocation } from "react-router";

/**
 * Entry of the authenticated area:
 * - anonymous visitor on "/"   -> the public landing page
 * - anonymous visitor elsewhere -> login (RequireAuth, unchanged)
 * - signed-in user              -> the application
 */
export function LandingGate() {
    const { status } = useAuth();
    const { pathname } = useLocation();
    if (status === "loading") return <FullPageSpinner />;
    if (status === "anonymous" && pathname === "/") return <LandingPage />;
    return <RequireAuth />;
}