import { createContext, useContext } from "react";
import type { Role, User } from "./types";

export interface Session {
    user: User;
    /** TEMPORARY (F2): previews each role. Removed in F3 when real authentication arrives. */
    setDemoRole?: (role: Role) => void;
}

export const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
    const session = useContext(SessionContext);
    if (!session) throw new Error("useSession must be used inside a session provider");
    return session;
}