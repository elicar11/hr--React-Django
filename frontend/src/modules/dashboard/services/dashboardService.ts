import { api } from "../../../lib/api";
import type { DashboardFilters, EmployeeDashboard, HrDashboard } from "../types";

export async function getHrDashboard(filters: DashboardFilters, signal?: AbortSignal): Promise<HrDashboard> {
    const { data } = await api.get<HrDashboard>("/dashboard/", { params: filters, signal });
    return data;
}

export async function getEmployeeDashboard(signal?: AbortSignal): Promise<EmployeeDashboard> {
    const { data } = await api.get<EmployeeDashboard>("/dashboard/employee/", { signal });
    return data;
}