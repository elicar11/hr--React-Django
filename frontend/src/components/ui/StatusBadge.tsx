import {
    Ban,
    Banknote,
    Calculator,
    Check,
    CircleAlert,
    CircleCheck,
    Clock,
    FileCheck,
    Flag,
    Lock,
    LockOpen,
    LogOut,
    Pause,
    Pencil,
    ShieldCheck,
    X,
    type LucideIcon,
} from "lucide-react";
import { Badge, type BadgeTone } from "./Badge";

export type StatusDomain =
    | "employee"
    | "contract"
    | "leave"
    | "payslip"
    | "period"
    | "attendance"
    | "correction";

interface StatusConfig {
    label: string;
    tone: BadgeTone;
    icon: LucideIcon;
}

const REQUEST_STATUSES: Record<string, StatusConfig> = {
    PENDING: { label: "En attente", tone: "dashed", icon: Clock },
    APPROVED: { label: "Approuvée", tone: "solid", icon: Check },
    REJECTED: { label: "Refusée", tone: "alert", icon: X },
    CANCELLED: { label: "Annulée", tone: "struck", icon: Ban },
};

/** French labels of the backend status codes, one table per domain. */
const STATUSES: Record<StatusDomain, Record<string, StatusConfig>> = {
    employee: {
        ACTIVE: { label: "En poste", tone: "solid", icon: CircleCheck },
        SUSPENDED: { label: "Suspendu", tone: "dashed", icon: Pause },
        TERMINATED: { label: "Sorti", tone: "muted", icon: LogOut },
    },
    contract: {
        DRAFT: { label: "Brouillon", tone: "dashed", icon: Pencil },
        ACTIVE: { label: "En cours", tone: "solid", icon: CircleCheck },
        ENDED: { label: "Terminé", tone: "muted", icon: Flag },
        TERMINATED: { label: "Rompu", tone: "alert", icon: Ban },
    },
    leave: REQUEST_STATUSES,
    correction: REQUEST_STATUSES,
    payslip: {
        DRAFT: { label: "Brouillon", tone: "dashed", icon: Pencil },
        CALCULATED: { label: "Calculé", tone: "outline", icon: Calculator },
        VALIDATED: { label: "Validé", tone: "solid", icon: ShieldCheck },
        PAID: { label: "Payé", tone: "solid", icon: Banknote },
        CANCELLED: { label: "Annulé", tone: "struck", icon: Ban },
    },
    period: {
        OPEN: { label: "Ouverte", tone: "outline", icon: LockOpen },
        CLOSED: { label: "Clôturée", tone: "solid", icon: Lock },
    },
    attendance: {
        PRESENT: { label: "Présent", tone: "solid", icon: Check },
        ABSENT_JUSTIFIED: { label: "Absence justifiée", tone: "outline", icon: FileCheck },
        ABSENT_UNJUSTIFIED: { label: "Absence injustifiée", tone: "alert", icon: CircleAlert },
    },
};

export function StatusBadge({ domain, status }: { domain: StatusDomain; status: string }) {
    const config = STATUSES[domain][status];
    if (!config) return <Badge tone="muted">{status}</Badge>;
    return (
        <Badge tone={config.tone} icon={config.icon}>
            {config.label}
        </Badge>
    );
}

/** For the boolean `is_active` fields. */
export function ActiveBadge({ active }: { active: boolean }) {
    return active ? (
        <Badge tone="solid" icon={CircleCheck}>
            Actif
        </Badge>
    ) : (
        <Badge tone="muted" icon={Ban}>
            Inactif
        </Badge>
    );
}