import { createContext, useContext } from "react";
import type { User } from "./types";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

export interface AuthContextValue {
    status: AuthStatus;
    user: User | null;
    /** Message shown on the login page (expired session, password changed...). */
    notice: string | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    /** Ends the local session without calling the API (session expired, password changed or reset). */
    endSession: (notice?: string) => void;
    clearNotice: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
    return context;
}