import type { ColumnDef } from "@tanstack/react-table";
import { Briefcase, Pencil, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
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
import { LEVELS, PositionFormModal, levelLabel } from "../components/PositionFormModal";
import {
    deletePosition,
    flattenDepartments,
    getDepartmentTree,
    listPositions,
    setPositionActive,
} from "../services/organizationService";
import type { Position } from "../types";

export function PositionsPage() {
    const list = useListParams(["is_active", "department", "level"]);

    const [version, setVersion] = useState(0);
    const refresh = () => setVersion((current) => current + 1);

    const [editing, setEditing] = useState<Position | "new" | null>(null);
    const [toggling, setToggling] = useState<Position | null>(null);
    const [deleting, setDeleting] = useState<Position | null>(null);

    const departmentFilter = list.filters.department;
    const params = {
        page: list.page,
        search: list.search || undefined,
        ordering: list.ordering || undefined,
        is_active: list.filters.is_active || undefined,
        level: list.filters.level || undefined,
        ...(departmentFilter === "none"
            ? { department__isnull: "true" }
            : departmentFilter
                ? { department: departmentFilter }
                : {}),
    };
    const query = useApiQuery(["positions", params, version], (signal) => listPositions(params, signal));
    const tree = useApiQuery(["departments-tree", version], (signal) => getDepartmentTree(signal));
    const departmentOptions = flattenDepartments(tree.data ?? []);

    async function activate(position: Position) {
        try {
            await setPositionActive(position.id, true);
            notify.success("Poste activé");
            refresh();
        } catch (error) {
            notify.error(error);
        }
    }

    function PositionActions({ position }: { position: Position }) {
        return (
            <RowActions
                label={`Actions pour ${position.title}`}
                items={[
                    { label: "Modifier", icon: Pencil, onSelect: () => setEditing(position) },
                    position.is_active
                        ? { label: "Désactiver", icon: PowerOff, onSelect: () => setToggling(position) }
                        : { label: "Activer", icon: Power, onSelect: () => void activate(position) },
                    { label: "Supprimer", icon: Trash2, tone: "danger", separatorBefore: true, onSelect: () => setDeleting(position) },
                ]}
            />
        );
    }

    const columns: ColumnDef<Position>[] = [
        { accessorKey: "code", header: "Code", cell: ({ getValue }) => <strong>{String(getValue())}</strong> },
        { accessorKey: "title", header: "Intitulé" },
        { accessorKey: "level", header: "Niveau", cell: ({ row }) => <Badge tone="outline">{row.original.level}</Badge> },
        { id: "department_name", header: "Département", enableSorting: false, cell: ({ row }) => row.original.department_name ?? "—" },
        {
            id: "employees_count",
            header: "Employés",
            enableSorting: false,
            cell: ({ row }) => (
                <Link
                    to={`/employees?position=${row.original.id}`}
                    className="font-bold underline underline-offset-4 hover:bg-ink hover:text-paper"
                >
                    {row.original.employees_count}
                </Link>
            ),
        },
        { id: "is_active", header: "Statut", enableSorting: false, cell: ({ row }) => <ActiveBadge active={row.original.is_active} /> },
        {
            id: "actions",
            header: () => <span className="sr-only">Actions</span>,
            enableSorting: false,
            cell: ({ row }) => <PositionActions position={row.original} />,
        },
    ];

    const firstLoad = query.loading && !query.data;

    return (
        <>
            <PageHeader
                title="Postes"
                description="Postes occupés dans l'entreprise, avec leur niveau hiérarchique."
                actions={
                    <Button onClick={() => setEditing("new")} leftIcon={<Plus className="size-4" aria-hidden="true" />}>
                        Nouveau poste
                    </Button>
                }
            />

            <FilterBar canReset={list.hasActiveFilters} onReset={list.reset}>
                <SearchInput className="w-full max-w-xs" value={list.searchText} onChange={list.setSearchText} placeholder="Code ou intitulé…" />
                <Select label="Département" className="min-w-56" value={departmentFilter} placeholder="Tous" onChange={(e) => list.setFilter("department", e.target.value)}>
                    <option value="none">Sans département</option>
                    {departmentOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                            {option.label}
                        </option>
                    ))}
                </Select>
                <Select label="Niveau" className="min-w-40" value={list.filters.level} placeholder="Tous" onChange={(e) => list.setFilter("level", e.target.value)}>
                    {LEVELS.map((level) => (
                        <option key={level} value={level}>
                            {levelLabel(level)}
                        </option>
                    ))}
                </Select>
                <Select label="Statut" className="min-w-40" value={list.filters.is_active} placeholder="Tous" onChange={(e) => list.setFilter("is_active", e.target.value)}>
                    <option value="true">Actifs</option>
                    <option value="false">Inactifs</option>
                </Select>
            </FilterBar>

            {query.error && (
                <Alert tone="error" title="Impossible de charger les postes" className="mb-4">
                    <p>{query.error.message}</p>
                    <Button size="sm" variant="secondary" className="mt-2" onClick={query.reload}>
                        Réessayer
                    </Button>
                </Alert>
            )}

            <div aria-busy={query.loading || undefined} className={query.loading && query.data ? "opacity-60" : undefined}>
                <DataTable
                    caption="Liste des postes"
                    columns={columns}
                    data={query.data?.results ?? []}
                    loading={firstLoad}
                    getRowId={(row) => String(row.id)}
                    sorting={list.sorting}
                    onSortingChange={list.setSorting}
                    emptyState={
                        list.hasActiveFilters ? (
                            <EmptyState
                                icon={Briefcase}
                                title="Aucun résultat"
                                description="Aucun poste ne correspond à ces critères."
                                action={<Button variant="secondary" onClick={list.reset}>Réinitialiser les filtres</Button>}
                            />
                        ) : (
                            <EmptyState
                                icon={Briefcase}
                                title="Aucun poste"
                                description="Commencez par créer le premier poste."
                                action={<Button onClick={() => setEditing("new")}>Créer un poste</Button>}
                            />
                        )
                    }
                    renderMobileCard={(row) => (
                        <div className="space-y-2">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="font-bold">{row.code} · {row.title}</p>
                                    <p className="text-sm text-gray-dark">{row.department_name ?? "Poste transversal"}</p>
                                </div>
                                <PositionActions position={row} />
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-sm">
                                <ActiveBadge active={row.is_active} />
                                <Badge tone="outline">Niveau {row.level}</Badge>
                                <span>{row.employees_count} employé(s)</span>
                            </div>
                        </div>
                    )}
                />
            </div>
            <Pagination page={list.page} count={query.data?.count ?? 0} onPageChange={list.setPage} />

            <PositionFormModal
                open={editing !== null}
                position={editing === "new" ? null : editing}
                tree={tree.data ?? []}
                onClose={() => setEditing(null)}
                onSaved={refresh}
            />

            <ConfirmDialog
                open={toggling !== null}
                onClose={() => setToggling(null)}
                title="Désactiver ce poste ?"
                message={
                    <>
                        Le poste <strong>{toggling?.title}</strong> ne pourra plus être attribué. Il reste consultable et peut être réactivé.
                    </>
                }
                confirmLabel="Désactiver"
                onConfirm={async () => {
                    if (!toggling) return;
                    await setPositionActive(toggling.id, false);
                    notify.success("Poste désactivé");
                    refresh();
                }}
            />

            <ConfirmDialog
                open={deleting !== null}
                onClose={() => setDeleting(null)}
                tone="danger"
                title="Supprimer ce poste ?"
                message={
                    <>
                        <p>
                            Supprimer le poste <strong>{deleting?.title}</strong> est irréversible.
                        </p>
                        <p className="mt-2 text-sm text-gray-dark">
                            Si des employés ou des contrats y sont rattachés, la suppression sera refusée : désactivez-le plutôt.
                        </p>
                    </>
                }
                confirmLabel="Supprimer"
                onConfirm={async () => {
                    if (!deleting) return;
                    await deletePosition(deleting.id);
                    notify.success("Poste supprimé");
                    if (query.data?.results.length === 1 && list.page > 1) list.setPage(list.page - 1);
                    refresh();
                }}
            />
        </>
    );
}