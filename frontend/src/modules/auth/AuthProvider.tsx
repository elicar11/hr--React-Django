import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AuthContext, type AuthContextValue, type AuthStatus } from "./authContext";
import { setSessionExpiredHandler } from "./services/authInterceptors";
import { refreshAccessToken } from "./services/refreshAccessToken";
import * as authService from "./services/authService";
import { clearAccessToken, getAccessToken, setAccessToken } from "./tokenStore";
import type { User } from "./types";

export function AuthProvider({ children }: { children: ReactNode }) {
    const [status, setStatus] = useState<AuthStatus>("loading");
    const [user, setUser] = useState<User | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const endSession = useCallback((message?: string) => {
        clearAccessToken();
        setUser(null);
        setStatus("anonymous");
        setNotice(message ?? null);
    }, []);

    // Restore the session after a page load: the HttpOnly cookie gives a new access token.
    useEffect(() => {
        let ignore = false;
        async function restore() {
            try {
                await refreshAccessToken();
                const me = await authService.fetchMe();
                if (!ignore) {
                    setUser(me);
                    setStatus("authenticated");
                }
            } catch {
                if (!ignore) endSession();
            }
        }
        void restore();
        return () => {
            ignore = true;
        };
    }, [endSession]);

    // The interceptor calls this when a 401 cannot be recovered.
    useEffect(() => {
        setSessionExpiredHandler(() => {
            // No token = the user already logged out: nothing to announce.
            if (getAccessToken() !== null) endSession("Votre session a expiré. Veuillez vous reconnecter.");
        });
        return () => setSessionExpiredHandler(null);
    }, [endSession]);

    const login = useCallback(async (email: string, password: string) => {
        const result = await authService.login(email, password);
        setAccessToken(result.access);
        setUser(result.user);
        setNotice(null);
        setStatus("authenticated");
    }, []);

    const logout = useCallback(async () => {
        try {
            await authService.logout();
        } catch {
            // The cookie may already be gone: the local session ends anyway.
        }
        endSession();
    }, [endSession]);

    const clearNotice = useCallback(() => setNotice(null), []);

    const value = useMemo<AuthContextValue>(
        () => ({ status, user, notice, login, logout, endSession, clearNotice }),
        [status, user, notice, login, logout, endSession, clearNotice],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}