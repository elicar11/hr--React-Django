import type { ColumnDef } from "@tanstack/react-table";
import { FileText, Pencil, Plus, Power, PowerOff, Trash2 } from "lucide-react";
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
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useListParams } from "@/lib/hooks/useListParams";
import { notify } from "@/lib/notify";
import { ContractTypeFormModal } from "../components/ContractTypeFormModal";
import { deleteContractType, listContractTypes, updateContractType } from "../services/contractService";
import type { ContractType } from "../types";

export function ContractTypesPage() {
    const list = useListParams(["is_active", "is_fixed_term"]);
    const [version, setVersion] = useState(0);
    const refresh = () => setVersion((current) => current + 1);
    const [editing, setEditing] = useState<ContractType | "new" | null>(null);
    const [deleting, setDeleting] = useState<ContractType | null>(null);

    const params = {
        page: list.page,
        search: list.search || undefined,
        ordering: list.ordering || undefined,
        is_active: list.filters.is_active || undefined,
        is_fixed_term: list.filters.is_fixed_term || undefined,
    };
    const query = useApiQuery(["contract-types", params, version], (signal) => listContractTypes(params, signal));

    async function toggle(type: ContractType) {
        try {
            await updateContractType(type.id, { is_active: !type.is_active });
            notify.success(type.is_active ? "Type désactivé" : "Type activé");
            refresh();
        } catch (error) {
            notify.error(error);
        }
    }

    function TypeActions({ type }: { type: ContractType }) {
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

    const columns: ColumnDef<ContractType>[] = [
        { accessorKey: "code", header: "Code", cell: ({ getValue }) => <strong>{String(getValue())}</strong> },
        { accessorKey: "name", header: "Nom" },
        {
            id: "is_fixed_term",
            header: "Durée",
            enableSorting: false,
            cell: ({ row }) => (
                <Badge tone={row.original.is_fixed_term ? "outline" : "solid"}>
                    {row.original.is_fixed_term ? "Déterminée" : "Indéterminée"}
                </Badge>
            ),
        },
        { id: "is_active", header: "Statut", enableSorting: false, cell: ({ row }) => <ActiveBadge active={row.original.is_active} /> },
        {
            id: "actions",
            header: () => <span className="sr-only">Actions</span>,
            enableSorting: false,
            cell: ({ row }) => <TypeActions type={row.original} />,
        },
    ];

    return (
        <>
            <PageHeader
                title="Types de contrat"
                description="Types utilisés pour les contrats (CDI, CDD…). Un type à durée déterminée impose une date de fin."
                breadcrumb={[{ label: "Contrats", to: "/contracts" }, { label: "Types de contrat" }]}
                actions={
                    <Button onClick={() => setEditing("new")} leftIcon={<Plus className="size-4" aria-hidden="true" />}>
                        Nouveau type
                    </Button>
                }
            />

            <FilterBar canReset={list.hasActiveFilters} onReset={list.reset}>
                <SearchInput className="w-full max-w-xs" value={list.searchText} onChange={list.setSearchText} placeholder="Code ou nom…" />
                <Select label="Durée" className="min-w-44" value={list.filters.is_fixed_term} placeholder="Toutes" onChange={(e) => list.setFilter("is_fixed_term", e.target.value)}>
                    <option value="true">Déterminée</option>
                    <option value="false">Indéterminée</option>
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
                    caption="Types de contrat"
                    columns={columns}
                    data={query.data?.results ?? []}
                    loading={query.loading && !query.data}
                    getRowId={(row) => String(row.id)}
                    sorting={list.sorting}
                    onSortingChange={list.setSorting}
                    emptyState={
                        <EmptyState
                            icon={FileText}
                            title={list.hasActiveFilters ? "Aucun résultat" : "Aucun type de contrat"}
                            description={list.hasActiveFilters ? "Aucun type ne correspond à ces critères." : "Créez d'abord un type (par exemple CDI) pour pouvoir créer des contrats."}
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
                                <TypeActions type={row} />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Badge tone="outline">{row.is_fixed_term ? "Déterminée" : "Indéterminée"}</Badge>
                                <ActiveBadge active={row.is_active} />
                            </div>
                        </div>
                    )}
                />
            </div>
            <Pagination page={list.page} count={query.data?.count ?? 0} onPageChange={list.setPage} />

            <ContractTypeFormModal
                open={editing !== null}
                contractType={editing === "new" ? null : editing}
                onClose={() => setEditing(null)}
                onSaved={refresh}
            />

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
                        <p className="mt-2 text-sm text-gray-dark">Si des contrats l'utilisent, la suppression sera refusée : désactivez-le plutôt.</p>
                    </>
                }
                confirmLabel="Supprimer"
                onConfirm={async () => {
                    if (!deleting) return;
                    await deleteContractType(deleting.id);
                    notify.success("Type supprimé");
                    if (query.data?.results.length === 1 && list.page > 1) list.setPage(list.page - 1);
                    refresh();
                }}
            />
        </>
    );
}