import type { ColumnDef } from "@tanstack/react-table";
import { CalendarDays, Pencil, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import { useState } from "react";
import {
    ActiveBadge,
    Alert,
    Badge,
    Button,
    ConfirmDialog,
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
import { notify } from "@/lib/notify";
import { LeaveTypeFormModal } from "../components/LeaveTypeFormModal";
import { deleteLeaveType, listLeaveTypes, updateLeaveType } from "../services/leaveService";
import type { LeaveType } from "../types";

export function LeaveTypesPage() {
    const list = useListParams(["is_active", "uses_balance", "is_paid"]);
    const [version, setVersion] = useState(0);
    const refresh = () => setVersion((current) => current + 1);
    const [editing, setEditing] = useState<LeaveType | "new" | null>(null);
    const [deleting, setDeleting] = useState<LeaveType | null>(null);

    const params = {
        page: list.page,
        search: list.search || undefined,
        ordering: list.ordering || undefined,
        is_active: list.filters.is_active || undefined,
        uses_balance: list.filters.uses_balance || undefined,
        is_paid: list.filters.is_paid || undefined,
    };
    const query = useApiQuery(["leave-types", params, version], (signal) => listLeaveTypes(params, signal));

    async function toggle(type: LeaveType) {
        try {
            await updateLeaveType(type.id, { is_active: !type.is_active });
            notify.success(type.is_active ? "Type désactivé" : "Type activé");
            refresh();
        } catch (error) {
            notify.error(error);
        }
    }

    function Actions({ type }: { type: LeaveType }) {
        return (
            <RowActions
                label={`Actions pour ${type.name}`}
                items={[
                    { label: "Modifier", icon: Pencil, onSelect: () => setEditing(type) },
                    type.is_active
                        ? { label: "Désactiver", icon: PowerOff, onSelect: () => void toggle(type) }
                        : { label: "Activer", icon: Power, onSelect: () => void toggle(type) },
                    { label: "Supprimer", icon: Trash2, tone: "danger", separatorBefore: true, onSelect: () => setDeleting(type) },
                ]}
            />
        );
    }

    const columns: ColumnDef<LeaveType>[] = [
        { accessorKey: "code", header: "Code", cell: ({ getValue }) => <strong>{String(getValue())}</strong> },
        { accessorKey: "name", header: "Nom" },
        {
            id: "mode",
            header: "Décompte",
            enableSorting: false,
            cell: ({ row }) => (row.original.day_count_mode === "WORKING_DAYS" ? "Jours ouvrés" : "Jours calendaires"),
        },
        {
            id: "balance",
            header: "Solde",
            enableSorting: false,
            cell: ({ row }) =>
                row.original.uses_balance ? (
                    <Badge tone="outline">
                        {row.original.annual_allowance ? `${formatDecimal(row.original.annual_allowance)} j/an` : "Avec solde"}
                    </Badge>
                ) : (
                    <Badge tone="muted">Sans solde</Badge>
                ),
        },
        {
            id: "flags",
            header: "Particularités",
            enableSorting: false,
            cell: ({ row }) => (
                <span className="flex flex-wrap gap-1">
                    {row.original.requires_document && <Badge tone="dashed">Justificatif</Badge>}
                    {!row.original.is_paid && <Badge tone="solid">Non payé</Badge>}
                </span>
            ),
        },
        { id: "is_active", header: "Statut", enableSorting: false, cell: ({ row }) => <ActiveBadge active={row.original.is_active} /> },
        {
            id: "actions",
            header: () => <span className="sr-only">Actions</span>,
            enableSorting: false,
            cell: ({ row }) => <Actions type={row.original} />,
        },
    ];

    return (
        <>
            <PageHeader
                title="Types de congé"
                description="Congés annuels, maladie, exceptionnels, sans solde… Chaque type fixe son mode de décompte et ses règles."
                actions={
                    <Button onClick={() => setEditing("new")} leftIcon={<Plus className="size-4" aria-hidden="true" />}>
                        Nouveau type
                    </Button>
                }
            />
            <FilterBar canReset={list.hasActiveFilters} onReset={list.reset}>
                <SearchInput className="w-full max-w-xs" value={list.searchText} onChange={list.setSearchText} placeholder="Code ou nom…" />
                <Select label="Solde" className="min-w-40" value={list.filters.uses_balance} placeholder="Tous" onChange={(e) => list.setFilter("uses_balance", e.target.value)}>
                    <option value="true">Avec solde</option>
                    <option value="false">Sans solde</option>
                </Select>
                <Select label="Paiement" className="min-w-40" value={list.filters.is_paid} placeholder="Tous" onChange={(e) => list.setFilter("is_paid", e.target.value)}>
                    <option value="true">Payé</option>
                    <option value="false">Non payé</option>
                </Select>
                <Select label="Statut" className="min-w-40" value={list.filters.is_active} placeholder="Tous" onChange={(e) => list.setFilter("is_active", e.target.value)}>
                    <option value="true">Actifs</option>
                    <option value="false">Inactifs</option>
                </Select>
            </FilterBar>

            {query.error && (
                <Alert tone="error" title="Impossible de charger les types" className="mb-4">
                    <p>{query.error.message}</p>
                    <Button size="sm" variant="secondary" className="mt-2" onClick={query.reload}>
                        Réessayer
                    </Button>
                </Alert>
            )}
            <div aria-busy={query.loading || undefined} className={query.loading && query.data ? "opacity-60" : undefined}>
                <DataTable
                    caption="Types de congé"
                    columns={columns}
                    data={query.data?.results ?? []}
                    loading={query.loading && !query.data}
                    getRowId={(row) => String(row.id)}
                    sorting={list.sorting}
                    onSortingChange={list.setSorting}
                    emptyState={
                        <EmptyState
                            icon={CalendarDays}
                            title={list.hasActiveFilters ? "Aucun résultat" : "Aucun type de congé"}
                            description={list.hasActiveFilters ? "Aucun type ne correspond à ces critères." : "Créez d'abord un type (par exemple « Congés annuels ») pour que les employés puissent faire des demandes."}
                            action={
                                list.hasActiveFilters ? (
                                    <Button variant="secondary" onClick={list.reset}>Réinitialiser les filtres</Button>
                                ) : (
                                    <Button onClick={() => setEditing("new")}>Créer un type</Button>
                                )
                            }
                        />
                    }
                    renderMobileCard={(row) => (
                        <div className="space-y-2">
                            <div className="flex items-start justify-between gap-3">
                                <p className="font-bold">{row.code} · {row.name}</p>
                                <Actions type={row} />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Badge tone="outline">{row.uses_balance ? "Avec solde" : "Sans solde"}</Badge>
                                <ActiveBadge active={row.is_active} />
                            </div>
                        </div>
                    )}
                />
            </div>
            <Pagination page={list.page} count={query.data?.count ?? 0} onPageChange={list.setPage} />

            <LeaveTypeFormModal open={editing !== null} leaveType={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={refresh} />
            <ConfirmDialog
                open={deleting !== null}
                onClose={() => setDeleting(null)}
                tone="danger"
                title="Supprimer ce type ?"
                message={
                    <>
                        <p>
                            Supprimer le type <strong>{deleting?.name}</strong> est irréversible.
                        </p>
                        <p className="mt-2 text-sm text-gray-dark">Si des demandes ou des soldes l'utilisent, la suppression sera refusée : désactivez-le plutôt.</p>
                    </>
                }
                confirmLabel="Supprimer"
                onConfirm={async () => {
                    if (!deleting) return;
                    await deleteLeaveType(deleting.id);
                    notify.success("Type supprimé");
                    if (query.data?.results.length === 1 && list.page > 1) list.setPage(list.page - 1);
                    refresh();
                }}
            />
        </>
    );
} 