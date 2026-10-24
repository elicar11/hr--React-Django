export interface AlertItem {
    id: string;
    title: string;
    description?: string;
    to?: string;
}

/**
 * TEMPORARY (F2): always empty. In F4 it will be fed by /dashboard/ (pending leave requests,
 * contracts ending soon). The backend has no notification API: nothing is invented here.
 */
export function useAlerts(): { alerts: AlertItem[]; loading: boolean } {
    return { alerts: [], loading: false };
}