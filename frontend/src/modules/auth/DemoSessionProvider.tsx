import { useMemo, useState, type ReactNode } from "react";
import { SessionContext, type Session } from "./sessionContext";
import type { Role, User } from "./types";

const DEMO_USERS: Record<Role, Pick<User, "first_name" | "last_name" | "email">> = {
    ADMIN: { first_name: "Alex", last_name: "Admin", email: "admin@demo.local" },
    HR: { first_name: "Rina", last_name: "Rivière", email: "rh@demo.local" },
    EMPLOYEE: { first_name: "Eli", last_name: "Employé", email: "employe@demo.local" },
};

/** TEMPORARY (F2): fake session so that the layout can be built. Replaced by the real one in F3. */
export function DemoSessionProvider({ children }: { children: ReactNode }) {
    const [role, setRole] = useState<Role>("ADMIN");

    const value = useMemo<Session>(
        () => ({
            user: { id: 0, role, is_active: true, last_login: null, date_joined: "", ...DEMO_USERS[role] },
            setDemoRole: setRole,
        }),
        [role],
    );

    return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}