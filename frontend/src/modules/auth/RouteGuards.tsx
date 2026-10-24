import { Navigate, Outlet, useLocation } from "react-router";
import { FullPageSpinner } from "../../components/layout/FullPageSpinner";
import { ForbiddenPage } from "../../modules/core/pages/ForbiddenPage";
import { useAuth } from "./authContext";
import type { Role } from "./types";

/** Anonymous visitors go to the login page, and come back to the page they asked for. */
export function RequireAuth() {
    const { status } = useAuth();
    const location = useLocation();
    if (status === "loading") return <FullPageSpinner />;
    if (status === "anonymous") {
        return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
    }
    return <Outlet />;
}

/**
 * Hides a section from the wrong roles. A convenience only:
 * the backend enforces every permission on each endpoint.
 */
export function RequireRole({ roles }: { roles: readonly Role[] }) {
    const { user } = useAuth();
    if (!user || !roles.includes(user.role)) return <ForbiddenPage />;
    return <Outlet />;
}

/** Login page: a connected user is sent back where he was going. */
export function GuestOnly() {
    const { status } = useAuth();
    const location = useLocation();
    if (status === "loading") return <FullPageSpinner />;
    if (status === "authenticated") {
        const from = (location.state as { from?: string } | null)?.from ?? "/";
        return <Navigate to={from} replace />;
    }
    return <Outlet />;
}