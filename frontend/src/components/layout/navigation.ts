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
    // Palette,
    Settings,
    ShieldCheck,
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
    /** Paths that light this entry up (default: its own `to`). */
    activePrefixes?: readonly string[];
    /** Paths that belong to another entry although they start like this one. */
    excludePrefixes?: readonly string[];
}

/** A collapsible group of entries. */
export interface NavSection {
    label: string;
    icon: LucideIcon;
    items: NavItem[];
}

export type NavEntry = NavItem | NavSection;

export function isSection(entry: NavEntry): entry is NavSection {
    return "items" in entry;
}

const EVERYONE: readonly Role[] = ["ADMIN", "HR", "EMPLOYEE"];
const STAFF: readonly Role[] = ["ADMIN", "HR"];
const ADMIN_ONLY: readonly Role[] = ["ADMIN"];
const EMPLOYEE_ONLY: readonly Role[] = ["EMPLOYEE"];

/** Configuration screens: reached from the Settings page, which stays lit while the user is on one of them. */
// const PAYROLL_SETTINGS_PATHS = ["/payroll/settings", "/payroll/item-types", "/payroll/elements"];
// const SETTINGS_PATHS = [
//   "/settings",
//   "/contract-types",
//   "/work-schedules",
//   "/holidays",
//   "/leave-types",
//   "/leave-balances",
//   ...PAYROLL_SETTINGS_PATHS,
// ];

/** Hiding an entry is a convenience only: the backend enforces every permission. */
const ENTRIES: NavEntry[] = [
    { label: "Tableau de bord", to: "/", icon: LayoutDashboard, roles: EVERYONE },
    {
        label: "Personnel",
        icon: Users,
        items: [
            { label: "Employés", to: "/employees", icon: Users, roles: STAFF },
            { label: "Contrats", to: "/contracts", icon: FileText, roles: STAFF },
            { label: "Départements", to: "/departments", icon: Building2, roles: STAFF },
            { label: "Postes", to: "/positions", icon: Briefcase, roles: STAFF },
        ],
    },
    {
        label: "Temps de travail",
        icon: Clock,
        items: [
            { label: "Présences", to: "/attendance", icon: Clock, roles: STAFF, activePrefixes: ["/attendance", "/work-schedules", "/holidays"] },
            { label: "Congés", to: "/leaves", icon: CalendarDays, roles: STAFF, activePrefixes: ["/leaves", "/leave-types", "/leave-balances"] },
            { label: "Calendrier RH", to: "/calendar", icon: CalendarRange, roles: STAFF },
        ],
    },
    { label: "Paie", to: "/payroll", icon: Banknote, roles: STAFF },
    {
        label: "Administration",
        icon: ShieldCheck,
        items: [
            { label: "Utilisateurs et rôles", to: "/users", icon: UsersRound, roles: ADMIN_ONLY },
            { label: "Journal d'audit", to: "/audit", icon: History, roles: ADMIN_ONLY },
        ],
    },
    { label: "Paramètres", to: "/settings", icon: Settings, roles: STAFF, activePrefixes: ["/settings", "/contract-types"] },

    { label: "Mon dossier", to: "/my/profile", icon: UserCircle, roles: EMPLOYEE_ONLY },
    { label: "Mes présences", to: "/my/attendance", icon: Clock, roles: EMPLOYEE_ONLY },
    { label: "Mes congés", to: "/my/leaves", icon: CalendarDays, roles: EMPLOYEE_ONLY, activePrefixes: ["/my/leaves", "/leaves"] },
    { label: "Mes contrats", to: "/my/contracts", icon: FileText, roles: EMPLOYEE_ONLY },
    { label: "Mes bulletins", to: "/my/payslips", icon: Banknote, roles: EMPLOYEE_ONLY },


];

// const DEV_ENTRY: NavItem = { label: "Kit UI (démo)", to: "/ui-kit", icon: Palette, roles: EVERYONE };

function matches(pathname: string, prefix: string): boolean {
    return prefix === "/" ? pathname === "/" : pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isItemActive(item: NavItem, pathname: string): boolean {
    if (item.excludePrefixes?.some((prefix) => matches(pathname, prefix))) return false;
    return (item.activePrefixes ?? [item.to]).some((prefix) => matches(pathname, prefix));
}

/** Navigation visible for a role (sections left without any entry are dropped). */
export function navigationFor(role: Role): NavEntry[] {
    // const entries = import.meta.env.DEV ? [...ENTRIES, DEV_ENTRY] : ENTRIES;
    const entries = ENTRIES;
    return entries.flatMap((entry): NavEntry[] => {
        if (!isSection(entry)) return entry.roles.includes(role) ? [entry] : [];
        const items = entry.items.filter((item) => item.roles.includes(role));
        return items.length > 0 ? [{ ...entry, items }] : [];
    });
}