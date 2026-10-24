import { useEffect, useState } from "react";
import { useSession } from "@/modules/auth/sessionContext";
import { getEmployeeDashboard, getHrDashboard } from "@/modules/dashboard/services/dashboardService";
import type { EmployeeDashboard, HrDashboard } from "@/modules/dashboard/types";

export interface AlertItem {
    id: string;
    title: string;
    description?: string;
    to?: string;
}

const REFRESH_MS = 5 * 60 * 1000;

function staffAlerts(data: HrDashboard): AlertItem[] {
    const { kpis } = data;
    const alerts: AlertItem[] = [];
    if (kpis.pending_leave_requests > 0) {
        alerts.push({
            id: "pending-leaves",
            title: `${kpis.pending_leave_requests} demande(s) de congé en attente`,
            description: "À valider",
            to: "/leaves?status=PENDING",
        });
    }
    if (kpis.contracts_overdue > 0) {
        alerts.push({
            id: "overdue-contracts",
            title: `${kpis.contracts_overdue} contrat(s) à clôturer`,
            description: "La date de fin est dépassée",
            to: "/contracts?view=expiring",
        });
    }
    if (kpis.contracts_expiring_soon > 0) {
        alerts.push({
            id: "expiring-contracts",
            title: `${kpis.contracts_expiring_soon} contrat(s) arrivent à échéance`,
            description: `Dans les ${kpis.contract_alert_days} prochains jours`,
            to: "/contracts?view=expiring",
        });
    }
    return alerts;
}

function employeeAlerts(data: EmployeeDashboard): AlertItem[] {
    const alerts: AlertItem[] = [];
    if (data.today.is_working_day && !data.today.record) {
        alerts.push({
            id: "clock-in",
            title: "Pointage du jour",
            description: "Vous n'avez pas encore pointé votre entrée.",
            to: "/",
        });
    }
    return alerts;
}

/**
 * The backend has no notification API: alerts are derived from the dashboards,
 * refreshed every 5 minutes. A failure simply shows no alert.
 */
export function useAlerts(): { alerts: AlertItem[]; loading: boolean } {
    const { user } = useSession();
    const isStaff = user.role === "ADMIN" || user.role === "HR";
    const [state, setState] = useState<{ alerts: AlertItem[]; loading: boolean }>({ alerts: [], loading: true });

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                const alerts = isStaff ? staffAlerts(await getHrDashboard({})) : employeeAlerts(await getEmployeeDashboard());
                if (!cancelled) setState({ alerts, loading: false });
            } catch {
                if (!cancelled) setState({ alerts: [], loading: false });
            }
        }

        void load();
        const timer = setInterval(() => void load(), REFRESH_MS);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [isStaff]);

    return state;
}