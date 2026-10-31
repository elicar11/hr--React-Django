import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Link } from "react-router";
import { Alert, Button, EmptyState, FilterBar, PageHeader, Select, Skeleton, StatusBadge } from "@/components/ui";
import { currentMonthKey, formatMonthLong, monthGrid, shiftMonth } from "@/lib/calendar";
import { formatDate, formatDecimal } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useListParams } from "@/lib/hooks/useListParams";
import { flattenDepartments, getDepartmentTree } from "@/modules/organization/services/organizationService";
import { MonthCalendar } from "../components/MonthCalendar";
import { getAllLeaveTypes, getLeaveCalendar } from "../services/leaveService";

export function LeaveCalendarPage() {
    const list = useListParams(["department", "leave_type", "status"]);
    const requested = list.getParam("month");
    const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : currentMonthKey();

    // The grid also shows the days of the neighbouring months: ask for the whole grid.
    const weeks = monthGrid(month);
    const dateFrom = weeks[0][0];
    const dateTo = weeks[weeks.length - 1][6];
    const params = {
        date_from: dateFrom,
        date_to: dateTo,
        department: list.filters.department || undefined,
        leave_type: list.filters.leave_type || undefined,
        status: list.filters.status || undefined,
    };
    const query = useApiQuery(["leave-calendar", params], (signal) => getLeaveCalendar(params, signal));
    const types = useApiQuery(["leave-types-all"], (signal) => getAllLeaveTypes(signal, false));
    const tree = useApiQuery(["departments-tree"], (signal) => getDepartmentTree(signal));

    const leaves = query.data?.leaves ?? [];
    // Agenda: the leaves touching the month itself, in chronological order.
    const monthStart = `${month}-01`;
    const monthEnd = `${month}-31`;
    const agenda = leaves
        .filter((leave) => leave.start_date <= monthEnd && leave.end_date >= monthStart)
        .sort((a, b) => a.start_date.localeCompare(b.start_date));

    function goTo(key: string) {
        list.setParam("month", key === currentMonthKey() ? "" : key);
    }

    return (
        <>
            <PageHeader title="Calendrier RH" description="Congés approuvés, demandes en attente et jours fériés." />

            <div className="mb-4 flex flex-wrap items-center gap-3">
                <Button variant="secondary" aria-label="Mois précédent" onClick={() => goTo(shiftMonth(month, -1))}>
                    <ChevronLeft className="size-5" aria-hidden="true" />
                </Button>
                <h2 aria-live="polite" className="min-w-48 text-center text-2xl capitalize">
                    {formatMonthLong(month)}
                </h2>
                <Button variant="secondary" aria-label="Mois suivant" onClick={() => goTo(shiftMonth(month, 1))}>
                    <ChevronRight className="size-5" aria-hidden="true" />
                </Button>
                <Button variant="secondary" onClick={() => goTo(currentMonthKey())}>
                    Aujourd'hui
                </Button>
            </div>

            <FilterBar canReset={list.hasActiveFilters} onReset={list.reset}>
                <Select label="Département" className="min-w-56" value={list.filters.department} placeholder="Tous" onChange={(e) => list.setFilter("department", e.target.value)}>
                    {flattenDepartments(tree.data ?? []).map((option) => (
                        <option key={option.id} value={option.id}>
                            {option.label}
                        </option>
                    ))}
                </Select>
                <Select label="Type de congé" className="min-w-44" value={list.filters.leave_type} placeholder="Tous" onChange={(e) => list.setFilter("leave_type", e.target.value)}>
                    {(types.data ?? []).map((type) => (
                        <option key={type.id} value={type.id}>
                            {type.code} · {type.name}
                        </option>
                    ))}
                </Select>
                <Select label="Statut" className="min-w-44" value={list.filters.status} placeholder="Approuvés et en attente" onChange={(e) => list.setFilter("status", e.target.value)}>
                    <option value="APPROVED">Approuvés</option>
                    <option value="PENDING">En attente</option>
                </Select>
            </FilterBar>

            {query.error && (
                <Alert tone="error" title="Impossible de charger le calendrier" className="mb-4">
                    <p>{query.error.message}</p>
                    <Button size="sm" variant="secondary" className="mt-2" onClick={query.reload}>
                        Réessayer
                    </Button>
                </Alert>
            )}

            <p className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm" aria-hidden="true">
                <span className="flex items-center gap-2">
                    <span className="inline-block size-4 border-2 border-ink bg-ink" /> Approuvé
                </span>
                <span className="flex items-center gap-2">
                    <span className="inline-block size-4 border-2 border-dashed border-ink bg-paper" /> En attente
                </span>
            </p>

            <div aria-busy={query.loading || undefined} className={query.loading && query.data ? "opacity-60" : undefined}>
                {!query.data && query.loading && <Skeleton className="h-96" />}
                {query.data && (
                    <div className="hidden md:block">
                        <MonthCalendar month={month} leaves={leaves} holidays={query.data.holidays} />
                    </div>
                )}
            </div>

            {query.data && (
                <section className="mt-8 space-y-3">
                    <h2 className="text-2xl">Congés du mois ({agenda.length})</h2>
                    {agenda.length === 0 ? (
                        <EmptyState icon={CalendarDays} title="Aucun congé ce mois-ci" />
                    ) : (
                        <ul className="divide-y-2 divide-ink border-2 border-ink bg-paper">
                            {agenda.map((leave) => (
                                <li key={leave.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                                    <div>
                                        <Link to={`/leaves/${leave.id}`} className="font-bold underline underline-offset-4 hover:bg-ink hover:text-paper">
                                            {leave.employee_name}
                                        </Link>
                                        <p className="text-sm text-gray-dark">
                                            {leave.leave_type_name} · {formatDate(leave.start_date)} → {formatDate(leave.end_date)} · {formatDecimal(leave.days)} j
                                        </p>
                                    </div>
                                    <StatusBadge domain="leave" status={leave.status} />
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            )}
        </>
    );
}