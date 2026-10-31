import type { ColumnDef } from "@tanstack/react-table";
import { CalendarX, ListPlus, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import {
    Alert,
    Badge,
    Button,
    Checkbox,
    DataTable,
    EmptyState,
    FilterBar,
    PageHeader,
    Pagination,
    RowActions,
    Select,
} from "@/components/ui";
import { formatDate, formatDecimal, todayISO } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useListParams } from "@/lib/hooks/useListParams";
import { EmployeeFilterChip } from "@/modules/employees/components/EmployeeFilterChip";
import { EndElementModal } from "../components/EndElementModal";
import { PayElementFormModal } from "../components/PayElementFormModal";
import { PayrollBanner } from "../components/PayrollBanner";
import { getAllPayItemTypes, listPayElements } from "../services/payrollService";
import type { PayElement } from "../types";

export function PayElementsPage() {
    const list = useListParams(["employee", "item_type", "active_on"]);
    const [version, setVersion] = useState(0);
    const refresh = () => setVersion((current) => current + 1);
    const [creating, setCreating] = useState(false);
    const [ending, setEnding] = useState<PayElement | null>(null);

    const params = {
        page: list.page,
        ordering: "-start_date",
        employee: list.filters.employee || undefined,
        item_type: list.filters.item_type || undefined,
        active_on: list.filters.active_on || undefined,
    };
    const query = useApiQuery(["pay-elements", params, version], (signal) => listPayElements(params, signal));
    const types = useApiQuery(["pay-item-types-all"], (signal) => getAllPayItemTypes(signal, false));
    const employeeId = Number(list.filters.employee) || null;
    const today = todayISO();

    const columns: ColumnDef<PayElement>[] = [
        {
            id: "employee",
            header: "Employé",
            enableSorting: false,
            cell: ({ row }) => (
                <Link to={`/employees/${row.original.employee}`} className="font-bold underline underline-offset-4 hover:bg-ink hover:text-paper">
                    {row.original.employee_matricule}
                </Link>
            ),
        },
        { id: "item_type", header: "Type", enableSorting: false, cell: ({ row }) => `${row.original.item_type_code} · ${row.original.item_type_name}` },
        {
            id: "value",
            header: "Valeur",
            enableSorting: false,
            cell: ({ row }) => (
                <Badge tone="outline">
                    {row.original.amount !== null ? formatDecimal(row.original.amount) : `${formatDecimal(row.original.rate ?? "0", 4)} %`}
                </Badge>
            ),
        },
        { id: "start_date", header: "Début", enableSorting: false, cell: ({ row }) => formatDate(row.original.start_date) },
        {
            id: "end_date",
            header: "Fin",
            enableSorting: false,
            cell: ({ row }) => (row.original.end_date ? formatDate(row.original.end_date) : <Badge tone="solid">En cours</Badge>),
        },
        {
            id: "actions",
            header: () => <span className="sr-only">Actions</span>,
            enableSorting: false,
            cell: ({ row }) =>
                row.original.end_date === null || row.original.end_date >= today ? (
                    <RowActions
                        label={`Actions pour ${row.original.item_type_name}`}
                        items={[{ label: "Terminer l'élément", icon: CalendarX, tone: "danger", onSelect: () => setEnding(row.original) }]}
                    />
                ) : null,
        },
    ];

    return (
        <>
            <PageHeader
                title="Éléments de rémunération"
                description="Éléments récurrents attribués aux employés, avec leur historique."
                breadcrumb={[{ label: "Paie", to: "/payroll" }, { label: "Éléments par employé" }]}
                actions={
                    <Button onClick={() => setCreating(true)} leftIcon={<Plus className="size-4" aria-hidden="true" />}>
                        Nouvel élément
                    </Button>
                }
            />
            <PayrollBanner />

            <FilterBar canReset={list.hasActiveFilters} onReset={list.reset}>
                <Select label="Type" className="min-w-56" value={list.filters.item_type} placeholder="Tous" onChange={(e) => list.setFilter("item_type", e.target.value)}>
                    {(types.data ?? []).map((type) => (
                        <option key={type.id} value={type.id}>
                            {type.code} · {type.name}
                        </option>
                    ))}
                </Select>
                <Checkbox
                    label="Actifs aujourd'hui seulement"
                    checked={list.filters.active_on === today}
                    onChange={(event) => list.setFilter("active_on", event.target.checked ? today : "")}
                />
                {employeeId && <EmployeeFilterChip employeeId={employeeId} onClear={() => list.setFilter("employee", "")} />}
            </FilterBar>

            {query.error && (
                <Alert tone="error" title="Impossible de charger les éléments" className="mb-4">
                    <p>{query.error.message}</p>
                    <Button size="sm" variant="secondary" className="mt-2" onClick={query.reload}>
                        Réessayer
                    </Button>
                </Alert>
            )}
            <div aria-busy={query.loading || undefined} className={query.loading && query.data ? "opacity-60" : undefined}>
                <DataTable
                    caption="Éléments de rémunération des employés"
                    columns={columns}
                    data={query.data?.results ?? []}
                    loading={query.loading && !query.data}
                    getRowId={(row) => String(row.id)}
                    emptyState={
                        <EmptyState
                            icon={ListPlus}
                            title="Aucun élément"
                            description="Attribuez par exemple une indemnité à un employé. Les éléments appliqués à tous se règlent dans les types."
                            action={<Button onClick={() => setCreating(true)}>Ajouter un élément</Button>}
                        />
                    }
                    renderMobileCard={(row) => (
                        <div className="space-y-1">
                            <p className="font-bold">{row.employee_matricule} · {row.item_type_name}</p>
                            <p className="text-sm">
                                {row.amount !== null ? formatDecimal(row.amount) : `${formatDecimal(row.rate ?? "0", 4)} %`} · depuis le {formatDate(row.start_date)}
                                {row.end_date ? ` jusqu'au ${formatDate(row.end_date)}` : ""}
                            </p>
                            {(row.end_date === null || row.end_date >= today) && (
                                <Button size="sm" variant="secondary" onClick={() => setEnding(row)}>
                                    Terminer
                                </Button>
                            )}
                        </div>
                    )}
                />
            </div>
            <Pagination page={list.page} count={query.data?.count ?? 0} onPageChange={list.setPage} />

            <PayElementFormModal open={creating} onClose={() => setCreating(false)} onSaved={refresh} />
            {ending && <EndElementModal open element={ending} onClose={() => setEnding(null)} onSaved={refresh} />}
        </>
    );
}