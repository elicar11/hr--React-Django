export type Role = "ADMIN" | "HR" | "EMPLOYEE";

export const ROLE_LABELS: Record<Role, string> = {
    ADMIN: "Administrateur",
    HR: "Responsable RH",
    EMPLOYEE: "Employé",
};

/** Mirrors the backend UserSerializer. */
export interface User {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    role: Role;
    is_active: boolean;
    last_login: string | null;
    date_joined: string;
}