import { CalendarDays, Check, Eye, Plus, X, Ban } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import {
    Alert,
    Button,
    DateField,
    EmptyState,
    FilterBar,
    PageHeader,
    Pagination,
    SearchInput,
    Select,
    type MenuItem,
} from "@/components/ui";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useListParams } from "@/lib/hooks/useListParams";
import { EmployeeFilterChip } from "@/modules/employees/components/EmployeeFilterChip";
import { flattenDepartments, getDepartmentTree } from "@/modules/organization/services/organizationService";
import { LeaveDecisionDialogs, type DecisionTarget } from "../components/LeaveDecisionDialogs";
import { LeaveRequestModal } from "../components/LeaveRequestModal";
import { LeaveRequestsTable } from "../components/LeaveRequestsTable";
import { getAllLeaveTypes, listLeaveRequests } from "../services/leaveService";
import type { LeaveRequest } from "../types";

/** HR queue of leave requests (the dashboard links here with ?status=PENDING). */
export function LeavesPage() {
    const navigate = useNavigate();
    const list = useListParams(["status", "leave_type", "employee", "department", "period_from", "period_to"]);
    const [version, setVersion] = useState(0);
    const refresh = () => setVersion((current) => current + 1);
    const [creating, setCreating] = useState(false);
    const [decision, setDecision] = useState<DecisionTarget | null>(null);

    const params = {
        page: list.page,
        search: list.search || undefined,
        ordering: list.ordering || undefined,
        status: list.filters.status || undefined,
        leave_type: list.filters.leave_type || undefined,
        employee: list.filters.employee || undefined,
        department: list.filters.department || undefined,
        period_from: list.filters.period_from || undefined,
        period_to: list.filters.period_to || undefined,
    };
    const query = useApiQuery(["leave-requests", params, version], (signal) => listLeaveRequests(params, signal));
    const types = useApiQuery(["leave-types-all"], (signal) => getAllLeaveTypes(signal, false));
    const tree = useApiQuery(["departments-tree"], (signal) => getDepartmentTree(signal));
    const employeeId = Number(list.filters.employee) || null;

    function getActions(leave: LeaveRequest): MenuItem[] {
        const items: MenuItem[] = [{ label: "Voir la demande", icon: Eye, to: `/leaves/${leave.id}` }];
        if (leave.status === "PENDING") {
            items.push(
                { label: "Approuver", icon: Check, onSelect: () => setDecision({ leave, kind: "approve" }) },
                { label: "Refuser", icon: X, onSelect: () => setDecision({ leave, kind: "reject" }) },
            );
        }
        if (leave.status === "PENDING" || leave.status === "APPROVED") {
            items.push({ label: "Annuler", icon: Ban, tone: "danger", separatorBefore: true, onSelect: () => setDecision({ leave, kind: "cancel" }) });
        }
        return items;
    }

    return (
        <>
            <PageHeader
                title="Congés"
                description="Demandes de congé : validation, refus et suivi."
                actions={
                    <Button onClick={() => setCreating(true)} leftIcon={<Plus className="size-4" aria-hidden="true" />}>
                        Nouvelle demande
                    </Button>
                }
            />

            <FilterBar canReset={list.hasActiveFilters} onReset={list.reset}>
                <SearchInput className="w-full max-w-xs" value={list.searchText} onChange={list.setSearchText} placeholder="Matricule, nom…" />
                <Select label="Statut" className="min-w-44" value={list.filters.status} placeholder="Tous" onChange={(e) => list.setFilter("status", e.target.value)}>
                    <option value="PENDING">En attente</option>
                    <option value="APPROVED">Approuvée</option>
                    <option value="REJECTED">Refusée</option>
                    <option value="CANCELLED">Annulée</option>
                </Select>
                <Select label="Type" className="min-w-44" value={list.filters.leave_type} placeholder="Tous" onChange={(e) => list.setFilter("leave_type", e.target.value)}>
                    {(types.data ?? []).map((type) => (
                        <option key={type.id} value={type.id}>
                            {type.code} · {type.name}
                        </option>
                    ))}
                </Select>
                <Select label="Département" className="min-w-56" value={list.filters.department} placeholder="Tous" onChange={(e) => list.setFilter("department", e.target.value)}>
                    {flattenDepartments(tree.data ?? []).map((option) => (
                        <option key={option.id} value={option.id}>
                            {option.label}
                        </option>
                    ))}
                </Select>
                <DateField label="Période du" value={list.filters.period_from} onChange={(e) => list.setFilter("period_from", e.target.value)} />
                <DateField label="Au" value={list.filters.period_to} onChange={(e) => list.setFilter("period_to", e.target.value)} />
                {employeeId && <EmployeeFilterChip employeeId={employeeId} onClear={() => list.setFilter("employee", "")} />}
            </FilterBar>

            {query.error && (
                <Alert tone="error" title="Impossible de charger les demandes" className="mb-4">
                    <p>{query.error.message}</p>
                    <Button size="sm" variant="secondary" className="mt-2" onClick={query.reload}>
                        Réessayer
                    </Button>
                </Alert>
            )}

            <div aria-busy={query.loading || undefined} className={query.loading && query.data ? "opacity-60" : undefined}>
                <LeaveRequestsTable
                    caption="Demandes de congé"
                    rows={query.data?.results ?? []}
                    loading={query.loading && !query.data}
                    showEmployee
                    sorting={list.sorting}
                    onSortingChange={list.setSorting}
                    getActions={getActions}
                    emptyState={
                        <EmptyState
                            icon={CalendarDays}
                            title={list.hasActiveFilters ? "Aucun résultat" : "Aucune demande de congé"}
                            description={list.hasActiveFilters ? "Aucune demande ne correspond à ces critères." : "Les demandes des employés apparaîtront ici."}
                            action={list.hasActiveFilters ? <Button variant="secondary" onClick={list.reset}>Réinitialiser les filtres</Button> : undefined}
                        />
                    }
                />
            </div>
            <Pagination page={list.page} count={query.data?.count ?? 0} onPageChange={list.setPage} />

            <LeaveRequestModal open={creating} leave={null} asHr onClose={() => setCreating(false)} onSaved={(leave) => navigate(`/leaves/${leave.id}`)} />
            <LeaveDecisionDialogs target={decision} onClose={() => setDecision(null)} onDone={refresh} />
        </>
    );
}