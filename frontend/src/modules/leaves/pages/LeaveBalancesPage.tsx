import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Scale, Wand2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import {
    Alert,
    Button,
    DataTable,
    EmptyState,
    FilterBar,
    PageHeader,
    Pagination,
    RowActions,
    SearchInput,
    Select,
} from "@/components/ui";
import { formatDecimal } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useListParams } from "@/lib/hooks/useListParams";
import { EmployeeFilterChip } from "@/modules/employees/components/EmployeeFilterChip";
import { BalanceFormModal } from "../components/BalanceFormModal";
import { BalanceMeter } from "../components/BalanceMeter";
import { InitializeBalancesModal } from "../components/InitializeBalancesModal";
import { getAllLeaveTypes, listBalances } from "../services/leaveService";
import type { LeaveBalance } from "../types";

export function LeaveBalancesPage() {
    const list = useListParams(["year", "leave_type", "employee"]);
    const currentYear = new Date().getFullYear();
    const year = list.filters.year || String(currentYear);
    const [version, setVersion] = useState(0);
    const refresh = () => setVersion((current) => current + 1);
    const [editing, setEditing] = useState<LeaveBalance | "new" | null>(null);
    const [initializing, setInitializing] = useState(false);

    const params = {
        page: list.page,
        search: list.search || undefined,
        year: year === "all" ? undefined : year,
        leave_type: list.filters.leave_type || undefined,
        employee: list.filters.employee || undefined,
    };
    const query = useApiQuery(["leave-balances", params, version], (signal) => listBalances(params, signal));
    const types = useApiQuery(["leave-types-all"], (signal) => getAllLeaveTypes(signal, false));
    const employeeId = Number(list.filters.employee) || null;

    const columns: ColumnDef<LeaveBalance>[] = [
        {
            id: "employee",
            header: "Employé",
            enableSorting: false,
            cell: ({ row }) => (
                <Link to={`/employees/${row.original.employee}`} className="underline underline-offset-4 hover:bg-ink hover:text-paper">
                    <strong>{row.original.employee_name}</strong> ({row.original.employee_matricule})
                </Link>
            ),
        },
        { id: "type", header: "Type", enableSorting: false, cell: ({ row }) => row.original.leave_type_name },
        { id: "year", header: "Année", enableSorting: false, cell: ({ row }) => row.original.year },
        { id: "allocated", header: "Alloués", enableSorting: false, cell: ({ row }) => formatDecimal(row.original.allocated) },
        { id: "used", header: "Utilisés", enableSorting: false, cell: ({ row }) => formatDecimal(row.original.used) },
        {
            id: "remaining",
            header: "Restants",
            enableSorting: false,
            cell: ({ row }) => (
                <div className="min-w-32 space-y-1">
                    <strong className="font-display text-xl">{formatDecimal(row.original.remaining)}</strong>
                    <BalanceMeter balance={row.original} />
                </div>
            ),
        },
        {
            id: "actions",
            header: () => <span className="sr-only">Actions</span>,
            enableSorting: false,
            cell: ({ row }) => (
                <RowActions
                    label={`Actions pour le solde de ${row.original.employee_name}`}
                    items={[{ label: "Modifier l'allocation", icon: Pencil, onSelect: () => setEditing(row.original) }]}
                />
            ),
        },
    ];

    return (
        <>
            <PageHeader
                title="Soldes de congé"
                description="Jours alloués, utilisés et restants, par employé, type et année civile."
                actions={
                    <>
                        <Button variant="secondary" onClick={() => setInitializing(true)} leftIcon={<Wand2 className="size-4" aria-hidden="true" />}>
                            Initialiser une année
                        </Button>
                        <Button onClick={() => setEditing("new")} leftIcon={<Plus className="size-4" aria-hidden="true" />}>
                            Nouveau solde
                        </Button>
                    </>
                }
            />
            <FilterBar canReset={list.hasActiveFilters || list.filters.year !== ""} onReset={list.reset}>
                <SearchInput className="w-full max-w-xs" value={list.searchText} onChange={list.setSearchText} placeholder="Matricule, nom…" />
                <Select label="Année" className="min-w-36" value={year} onChange={(e) => list.setFilter("year", e.target.value)}>
                    {[currentYear - 1, currentYear, currentYear + 1].map((value) => (
                        <option key={value} value={value}>
                            {value}
                        </option>
                    ))}
                    <option value="all">Toutes</option>
                </Select>
                <Select label="Type" className="min-w-44" value={list.filters.leave_type} placeholder="Tous" onChange={(e) => list.setFilter("leave_type", e.target.value)}>
                    {(types.data ?? []).filter((type) => type.uses_balance).map((type) => (
                        <option key={type.id} value={type.id}>
                            {type.code} · {type.name}
                        </option>
                    ))}
                </Select>
                {employeeId && <EmployeeFilterChip employeeId={employeeId} onClear={() => list.setFilter("employee", "")} />}
            </FilterBar>

            {query.error && (
                <Alert tone="error" title="Impossible de charger les soldes" className="mb-4">
                    <p>{query.error.message}</p>
                    <Button size="sm" variant="secondary" className="mt-2" onClick={query.reload}>
                        Réessayer
                    </Button>
                </Alert>
            )}
            <div aria-busy={query.loading || undefined} className={query.loading && query.data ? "opacity-60" : undefined}>
                <DataTable
                    caption="Soldes de congé"
                    columns={columns}
                    data={query.data?.results ?? []}
                    loading={query.loading && !query.data}
                    getRowId={(row) => String(row.id)}
                    emptyState={
                        <EmptyState
                            icon={Scale}
                            title="Aucun solde"
                            description="Créez les soldes un par un, ou initialisez l'année à partir des allocations annuelles des types de congé."
                            action={<Button onClick={() => setInitializing(true)}>Initialiser une année</Button>}
                        />
                    }
                    renderMobileCard={(row) => (
                        <div className="space-y-2">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="font-bold">{row.employee_name}</p>
                                    <p className="text-sm text-gray-dark">{row.leave_type_name} · {row.year}</p>
                                </div>
                                <RowActions label={`Actions pour ${row.employee_name}`} items={[{ label: "Modifier l'allocation", icon: Pencil, onSelect: () => setEditing(row) }]} />
                            </div>
                            <p className="text-sm">
                                <strong className="font-display text-xl">{formatDecimal(row.remaining)}</strong> j restants sur {formatDecimal(row.allocated)}
                            </p>
                            <BalanceMeter balance={row} />
                        </div>
                    )}
                />
            </div>
            <Pagination page={list.page} count={query.data?.count ?? 0} onPageChange={list.setPage} />

            <BalanceFormModal open={editing !== null} balance={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={refresh} />
            <InitializeBalancesModal open={initializing} onClose={() => setInitializing(false)} onDone={refresh} />
        </>
    );
}