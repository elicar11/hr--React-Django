import { Ban, CalendarDays, Eye, Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Alert, Button, Card, EmptyState, FilterBar, PageHeader, Pagination, Select, type MenuItem } from "@/components/ui";
import { formatDecimal } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useListParams } from "@/lib/hooks/useListParams";
import { BalanceMeter } from "../components/BalanceMeter";
import { LeaveDecisionDialogs, type DecisionTarget } from "../components/LeaveDecisionDialogs";
import { LeaveRequestModal } from "../components/LeaveRequestModal";
import { LeaveRequestsTable } from "../components/LeaveRequestsTable";
import { listBalances, listLeaveRequests } from "../services/leaveService";
import type { LeaveRequest } from "../types";

/** Employee space: own balances, own requests, new request. The API only returns the user's own data. */
export function MyLeavesPage() {
    const navigate = useNavigate();
    const list = useListParams(["status"]);
    const year = new Date().getFullYear();
    const [version, setVersion] = useState(0);
    const refresh = () => setVersion((current) => current + 1);
    const [creating, setCreating] = useState(false);
    const [decision, setDecision] = useState<DecisionTarget | null>(null);

    const balances = useApiQuery(["my-balances", year, version], (signal) => listBalances({ year }, signal));
    const params = { page: list.page, ordering: list.ordering || "-start_date", status: list.filters.status || undefined };
    const requests = useApiQuery(["my-leaves", params, version], (signal) => listLeaveRequests(params, signal));

    function getActions(leave: LeaveRequest): MenuItem[] {
        const items: MenuItem[] = [{ label: "Voir la demande", icon: Eye, to: `/leaves/${leave.id}` }];
        if (leave.status === "PENDING" || leave.status === "APPROVED") {
            items.push({ label: "Annuler", icon: Ban, tone: "danger", separatorBefore: true, onSelect: () => setDecision({ leave, kind: "cancel" }) });
        }
        return items;
    }

    return (
        <>
            <PageHeader
                title="Mes congés"
                description="Vos soldes et vos demandes de congé."
                actions={
                    <Button onClick={() => setCreating(true)} leftIcon={<Plus className="size-4" aria-hidden="true" />}>
                        Demander un congé
                    </Button>
                }
            />

            <section aria-label={`Soldes ${year}`} className="mb-8 space-y-3">
                <h2 className="text-2xl">Mes soldes {year}</h2>
                {balances.error && <Alert tone="error">{balances.error.message}</Alert>}
                {balances.data && balances.data.results.length === 0 && (
                    <EmptyState icon={CalendarDays} title="Aucun solde" description="Aucun solde n'a encore été défini pour cette année. Contactez les ressources humaines." />
                )}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {(balances.data?.results ?? []).map((balance) => (
                        <div key={balance.id} className="space-y-2 border-2 border-ink bg-paper p-4 shadow-hard">
                            <p className="font-bold uppercase tracking-wide">{balance.leave_type_name}</p>
                            <p>
                                <strong className="font-display text-4xl">{formatDecimal(balance.remaining)}</strong>{" "}
                                <span className="text-sm">j restants</span>
                            </p>
                            <BalanceMeter balance={balance} />
                            <p className="text-sm text-gray-dark">
                                {formatDecimal(balance.used)} utilisés sur {formatDecimal(balance.allocated)}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            <Card title="Mes demandes">
                <FilterBar canReset={list.hasActiveFilters} onReset={list.reset}>
                    <Select label="Statut" className="min-w-44" value={list.filters.status} placeholder="Tous" onChange={(e) => list.setFilter("status", e.target.value)}>
                        <option value="PENDING">En attente</option>
                        <option value="APPROVED">Approuvée</option>
                        <option value="REJECTED">Refusée</option>
                        <option value="CANCELLED">Annulée</option>
                    </Select>
                </FilterBar>
                {requests.error && <Alert tone="error" className="mb-4">{requests.error.message}</Alert>}
                <div aria-busy={requests.loading || undefined} className={requests.loading && requests.data ? "opacity-60" : undefined}>
                    <LeaveRequestsTable
                        caption="Mes demandes de congé"
                        rows={requests.data?.results ?? []}
                        loading={requests.loading && !requests.data}
                        showEmployee={false}
                        sorting={list.sorting}
                        onSortingChange={list.setSorting}
                        getActions={getActions}
                        emptyState={
                            <EmptyState
                                icon={CalendarDays}
                                title="Aucune demande"
                                description="Vous n'avez fait aucune demande de congé."
                                action={<Button onClick={() => setCreating(true)}>Demander un congé</Button>}
                            />
                        }
                    />
                </div>
                <Pagination page={list.page} count={requests.data?.count ?? 0} onPageChange={list.setPage} />
            </Card>

            <LeaveRequestModal open={creating} leave={null} asHr={false} onClose={() => setCreating(false)} onSaved={(leave) => navigate(`/leaves/${leave.id}`)} />
            <LeaveDecisionDialogs target={decision} onClose={() => setDecision(null)} onDone={refresh} />
        </>
    );
}