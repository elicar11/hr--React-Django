import {
    Briefcase,
    CalendarCheck,
    CalendarClock,
    FileWarning,
    RefreshCw,
    UserCheck,
    UserMinus,
    UserPlus,
    UserX,
} from "lucide-react";
import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { ChartCard } from "@/components/charts/ChartCard";
import { HorizontalBarChart } from "@/components/charts/HorizontalBarChart";
import { MonthlyMovementsChart } from "@/components/charts/MonthlyMovementsChart";
import { Alert, Button, DateField, FilterBar, PageHeader, Select, StatCard } from "@/components/ui";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { formatDateTime, formatMonth } from "@/lib/format";
import { flattenDepartments, getDepartmentTree } from "@/modules/organization/services/organizationService";
import { getHrDashboard } from "../services/dashboardService";
import type { DashboardFilters } from "../types";
import { ActivityCard } from "./ActivityCard";
import { DeadlinesCard } from "./DeadlinesCard";

const FILTER_KEYS = ["date_from", "date_to", "department", "status"] as const;

export function HrDashboard() {
    const [searchParams, setSearchParams] = useSearchParams();
    const filters: DashboardFilters = {
        date_from: searchParams.get("date_from") ?? undefined,
        date_to: searchParams.get("date_to") ?? undefined,
        department: searchParams.get("department") ?? undefined,
        status: searchParams.get("status") ?? undefined,
    };

    const query = useApiQuery(["hr-dashboard", filters], (signal) => getHrDashboard(filters, signal));
    const departments = useApiQuery(["departments-tree"], (signal) => getDepartmentTree(signal));
    const departmentOptions = useMemo(() => flattenDepartments(departments.data ?? []), [departments.data]);

    const data = query.data;
    const firstLoad = query.loading && !data;
    const hasFilters = FILTER_KEYS.some((key) => searchParams.has(key));

    function updateFilter(name: (typeof FILTER_KEYS)[number], value: string) {
        const next = new URLSearchParams(searchParams);
        if (value) next.set(name, value);
        else next.delete(name);
        setSearchParams(next, { replace: true });
    }

    // Values shown in the date fields: the ones in the URL, else the defaults chosen by the API.
    const dateFrom = searchParams.get("date_from") ?? data?.filters.date_from ?? "";
    const dateTo = searchParams.get("date_to") ?? data?.filters.date_to ?? "";
    const kpis = data?.kpis;

    return (
        <>
            <PageHeader
                title="Tableau de bord"
                description="Vue d'ensemble des ressources humaines."
                actions={
                    <>
                        {data && <p className="self-center text-sm text-gray-dark">Mis à jour : {formatDateTime(data.generated_at)}</p>}
                        <Button
                            variant="secondary"
                            onClick={query.reload}
                            loading={query.loading && !!data}
                            leftIcon={<RefreshCw className="size-4" aria-hidden="true" />}
                        >
                            Actualiser
                        </Button>
                    </>
                }
            />

            <FilterBar canReset={hasFilters} onReset={() => setSearchParams({}, { replace: true })}>
                <DateField label="Du" value={dateFrom} max={dateTo || undefined} onChange={(event) => updateFilter("date_from", event.target.value)} />
                <DateField label="Au" value={dateTo} min={dateFrom || undefined} onChange={(event) => updateFilter("date_to", event.target.value)} />
                <Select label="Département" value={searchParams.get("department") ?? ""} placeholder="Tous" onChange={(event) => updateFilter("department", event.target.value)}>
                    {departmentOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                            {option.label}
                        </option>
                    ))}
                </Select>
                <Select label="Statut" value={searchParams.get("status") ?? ""} placeholder="Non sortis (par défaut)" onChange={(event) => updateFilter("status", event.target.value)}>
                    <option value="ACTIVE">En poste</option>
                    <option value="SUSPENDED">Suspendu</option>
                    <option value="TERMINATED">Sorti</option>
                </Select>
            </FilterBar>

            {query.error && (
                <Alert tone="error" title="Impossible de charger le tableau de bord" className="mb-6">
                    <p>{query.error.message}</p>
                    <Button size="sm" variant="secondary" className="mt-2" onClick={query.reload}>
                        Réessayer
                    </Button>
                </Alert>
            )}

            <section aria-label="Indicateurs" className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    label="Employés en poste"
                    value={kpis?.active_employees}
                    hint={kpis ? `${kpis.suspended_employees} suspendu(s)` : undefined}
                    icon={UserCheck}
                    to="/employees?employment_status=ACTIVE"
                    loading={firstLoad}
                />
                <StatCard
                    label="Recrutements"
                    value={kpis?.hires_in_period}
                    hint="Sur la période"
                    icon={UserPlus}
                    to={data ? `/employees?hire_date_from=${data.filters.date_from}&hire_date_to=${data.filters.date_to}` : undefined}
                    loading={firstLoad}
                />
                <StatCard
                    label="Départs"
                    value={kpis?.departures_in_period}
                    hint="Sur la période"
                    icon={UserMinus}
                    to="/employees?employment_status=TERMINATED"
                    loading={firstLoad}
                />
                <StatCard
                    label="Présents aujourd'hui"
                    value={kpis?.present_today}
                    hint="Pointages du jour"
                    icon={CalendarCheck}
                    to="/attendance"
                    loading={firstLoad}
                />
                <StatCard
                    label="Absents aujourd'hui"
                    value={kpis?.absent_today}
                    hint={kpis ? `dont ${kpis.on_leave_today} en congé` : undefined}
                    icon={UserX}
                    to="/attendance"
                    loading={firstLoad}
                />
                <StatCard
                    label="Congés en attente"
                    value={kpis?.pending_leave_requests}
                    hint="À valider"
                    icon={Briefcase}
                    to="/leaves?status=PENDING"
                    loading={firstLoad}
                />
                <StatCard
                    label="Contrats à échéance"
                    value={kpis?.contracts_expiring_soon}
                    hint={kpis ? `Sous ${kpis.contract_alert_days} jours` : undefined}
                    icon={CalendarClock}
                    to="/contracts?view=expiring"
                    loading={firstLoad}
                />
                <StatCard
                    label="Contrats à clôturer"
                    value={kpis?.contracts_overdue}
                    hint="Date de fin dépassée"
                    icon={FileWarning}
                    to="/contracts?view=expiring"
                    loading={firstLoad}
                />
            </section>

            {data && (
                <div className="space-y-8">
                    <div className="grid gap-6 lg:grid-cols-2">
                        <ChartCard
                            title="Effectif par département"
                            columns={["Département", "Employés"]}
                            rows={data.headcount_by_department.map((item) => [item.name, item.count])}
                        >
                            <HorizontalBarChart data={data.headcount_by_department.map((item) => ({ label: item.name, value: item.count }))} />
                        </ChartCard>

                        <ChartCard
                            title="Effectif par poste"
                            columns={["Poste", "Employés"]}
                            rows={data.headcount_by_position.map((item) => [item.title, item.count])}
                        >
                            <HorizontalBarChart data={data.headcount_by_position.map((item) => ({ label: item.title, value: item.count }))} />
                        </ChartCard>

                        <ChartCard
                            title="Types de contrat en cours"
                            columns={["Type de contrat", "Employés"]}
                            rows={data.contracts_by_type.map((item) => [item.name, item.count])}
                        >
                            <HorizontalBarChart data={data.contracts_by_type.map((item) => ({ label: item.name, value: item.count }))} />
                        </ChartCard>

                        <ChartCard
                            title="Recrutements et départs"
                            description="Par mois, sur la période"
                            columns={["Mois", "Recrutements", "Départs"]}
                            rows={data.monthly_movements.map((item) => [formatMonth(item.month), item.hires, item.departures])}
                        >
                            <MonthlyMovementsChart data={data.monthly_movements} />
                        </ChartCard>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <DeadlinesCard deadlines={data.deadlines} days={data.kpis.contract_alert_days} />
                        <ActivityCard entries={data.recent_activity} />
                    </div>
                </div>
            )}
        </>
    );
}