import {
    Banknote,
    Briefcase,
    Building2,
    CalendarDays,
    CalendarRange,
    Clock,
    FileText,
    History,
    LayoutDashboard,
    Palette,
    Settings,
    UserCircle,
    Users,
    UsersRound,
    type LucideIcon,
} from "lucide-react";
import type { Role } from "@/modules/auth/types";

export interface NavItem {
    label: string;
    to: string;
    icon: LucideIcon;
    roles: readonly Role[];
    end?: boolean;
}

export interface NavGroup {
    label?: string;
    items: NavItem[];
}

const EVERYONE: readonly Role[] = ["ADMIN", "HR", "EMPLOYEE"];
const STAFF: readonly Role[] = ["ADMIN", "HR"];
const ADMIN_ONLY: readonly Role[] = ["ADMIN"];
const EMPLOYEE_ONLY: readonly Role[] = ["EMPLOYEE"];

/** Hiding an entry is a convenience only: the backend enforces every permission. */
const GROUPS: NavGroup[] = [
    { items: [{ label: "Tableau de bord", to: "/", icon: LayoutDashboard, roles: EVERYONE, end: true }] },
    {
        label: "Personnel",
        items: [
            { label: "Employés", to: "/employees", icon: Users, roles: STAFF },
            { label: "Départements", to: "/departments", icon: Building2, roles: STAFF },
            { label: "Postes", to: "/positions", icon: Briefcase, roles: STAFF },
            { label: "Contrats", to: "/contracts", icon: FileText, roles: STAFF },
        ],
    },
    {
        label: "Temps de travail",
        items: [
            { label: "Présences", to: "/attendance", icon: Clock, roles: STAFF },
            { label: "Congés", to: "/leaves", icon: CalendarDays, roles: STAFF },
            { label: "Calendrier RH", to: "/calendar", icon: CalendarRange, roles: STAFF },
        ],
    },
    { label: "Rémunération", items: [{ label: "Paie", to: "/payroll", icon: Banknote, roles: STAFF }] },
    {
        label: "Administration",
        items: [
            { label: "Utilisateurs et rôles", to: "/users", icon: UsersRound, roles: ADMIN_ONLY },
            { label: "Journal d'audit", to: "/audit", icon: History, roles: ADMIN_ONLY },
            { label: "Paramètres", to: "/settings", icon: Settings, roles: STAFF },
        ],
    },
    {
        label: "Mon espace",
        items: [
            { label: "Mon profil", to: "/my/profile", icon: UserCircle, roles: EMPLOYEE_ONLY },
            { label: "Mes présences", to: "/my/attendance", icon: Clock, roles: EMPLOYEE_ONLY },
            { label: "Mes congés", to: "/my/leaves", icon: CalendarDays, roles: EMPLOYEE_ONLY },
            { label: "Mes contrats", to: "/my/contracts", icon: FileText, roles: EMPLOYEE_ONLY },
            { label: "Mes bulletins", to: "/my/payslips", icon: Banknote, roles: EMPLOYEE_ONLY },
        ],
    },
];

const DEV_GROUP: NavGroup = {
    label: "Développement",
    items: [{ label: "Kit UI (démo)", to: "/ui-kit", icon: Palette, roles: EVERYONE }],
};

/** Navigation visible for a role (empty groups are dropped). */
export function navigationFor(role: Role): NavGroup[] {
    const groups = import.meta.env.DEV ? [...GROUPS, DEV_GROUP] : GROUPS;
    return groups
        .map((group) => ({ ...group, items: group.items.filter((item) => item.roles.includes(role)) }))
        .filter((group) => group.items.length > 0);
}