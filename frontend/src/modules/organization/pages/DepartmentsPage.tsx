import type { ColumnDef } from "@tanstack/react-table";
import { Building2, List, Network, Plus, Power, PowerOff, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import {
    ActiveBadge,
    Alert,
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
    TabPanel,
    Tabs,
} from "@/components/ui";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useListParams } from "@/lib/hooks/useListParams";
import { notify } from "@/lib/notify";
import { DepartmentFormModal } from "../components/DepartmentFormModal";
import { DepartmentTreeView } from "../components/DepartmentTreeView";
import {
    deleteDepartment,
    flattenDepartments,
    getDepartmentTree,
    listDepartments,
    setDepartmentActive,
} from "../services/organizationService";
import type { Department } from "../types";

const VIEWS = [
    { id: "list", label: "Liste", icon: List },
    { id: "tree", label: "Organigramme", icon: Network },
];

export function DepartmentsPage() {
    const list = useListParams(["is_active", "parent"]);
    const view = list.getParam("view") === "tree" ? "tree" : "list";

    // Bumped after each change so that every query reloads.
    const [version, setVersion] = useState(0);
    const refresh = () => setVersion((current) => current + 1);

    const [editing, setEditing] = useState<Department | "new" | null>(null);
    const [toggling, setToggling] = useState<Department | null>(null);
    const [deleting, setDeleting] = useState<Department | null>(null);

    const parentFilter = list.filters.parent;
    const params = {
        page: list.page,
        search: list.search || undefined,
        ordering: list.ordering || undefined,
        is_active: list.filters.is_active || undefined,
        ...(parentFilter === "root" ? { parent__isnull: "true" } : parentFilter ? { parent: parentFilter } : {}),
    };
    const query = useApiQuery(["departments", params, version], (signal) => listDepartments(params, signal));
    const tree = useApiQuery(["departments-tree", version], (signal) => getDepartmentTree(signal));
    const parentOptions = flattenDepartments(tree.data ?? []);

    async function activate(department: Department) {
        try {
            await setDepartmentActive(department.id, true);
            notify.success("Département activé");
            refresh();
        } catch (error) {
            notify.error(error);
        }
    }

    const columns: ColumnDef<Department>[] = [
        { accessorKey: "code", header: "Code", cell: ({ getValue }) => <strong>{String(getValue())}</strong> },
        { accessorKey: "name", header: "Nom" },
        { id: "parent_name", header: "Rattaché à", enableSorting: false, cell: ({ row }) => row.original.parent_name ?? "—" },
        { id: "positions_count", header: "Postes", enableSorting: false, cell: ({ row }) => row.original.positions_count },
        {
            id: "employees_count",
            header: "Employés",
            enableSorting: false,
            cell: ({ row }) => (
                <Link
                    to={`/employees?department=${row.original.id}`}
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
            cell: ({ row }) => <DepartmentActions department={row.original} />,
        },
    ];

    function DepartmentActions({ department }: { department: Department }) {
        return (
            <RowActions
                label={`Actions pour ${department.name}`}
                items={[
                    { label: "Modifier", icon: Pencil, onSelect: () => setEditing(department) },
                    department.is_active
                        ? { label: "Désactiver", icon: PowerOff, onSelect: () => setToggling(department) }
                        : { label: "Activer", icon: Power, onSelect: () => void activate(department) },
                    { label: "Supprimer", icon: Trash2, tone: "danger", separatorBefore: true, onSelect: () => setDeleting(department) },
                ]}
            />
        );
    }

    const firstLoad = query.loading && !query.data;

    return (
        <>
            <PageHeader
                title="Départements"
                description="Structure de l'entreprise : départements et sous-départements."
                actions={
                    <Button onClick={() => setEditing("new")} leftIcon={<Plus className="size-4" aria-hidden="true" />}>
                        Nouveau département
                    </Button>
                }
            />

            <Tabs
                idPrefix="departments"
                label="Mode d'affichage"
                items={VIEWS}
                value={view}
                onChange={(id) => list.setParam("view", id === "tree" ? "tree" : "")}
            />

            <TabPanel idPrefix="departments" id="list" active={view === "list"}>
                <FilterBar canReset={list.hasActiveFilters} onReset={list.reset}>
                    <SearchInput className="w-full max-w-xs" value={list.searchText} onChange={list.setSearchText} placeholder="Code ou nom…" />
                    <Select label="Statut" className="min-w-40" value={list.filters.is_active} placeholder="Tous" onChange={(e) => list.setFilter("is_active", e.target.value)}>
                        <option value="true">Actifs</option>
                        <option value="false">Inactifs</option>
                    </Select>
                    <Select label="Rattaché à" className="min-w-56" value={parentFilter} placeholder="Tous" onChange={(e) => list.setFilter("parent", e.target.value)}>
                        <option value="root">Départements racines</option>
                        {parentOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                                {option.label}
                            </option>
                        ))}
                    </Select>
                </FilterBar>

                {query.error && (
                    <Alert tone="error" title="Impossible de charger les départements" className="mb-4">
                        <p>{query.error.message}</p>
                        <Button size="sm" variant="secondary" className="mt-2" onClick={query.reload}>
                            Réessayer
                        </Button>
                    </Alert>
                )}

                <div aria-busy={query.loading || undefined} className={query.loading && query.data ? "opacity-60" : undefined}>
                    <DataTable
                        caption="Liste des départements"
                        columns={columns}
                        data={query.data?.results ?? []}
                        loading={firstLoad}
                        getRowId={(row) => String(row.id)}
                        sorting={list.sorting}
                        onSortingChange={list.setSorting}
                        emptyState={
                            list.hasActiveFilters ? (
                                <EmptyState
                                    icon={Building2}
                                    title="Aucun résultat"
                                    description="Aucun département ne correspond à ces critères."
                                    action={<Button variant="secondary" onClick={list.reset}>Réinitialiser les filtres</Button>}
                                />
                            ) : (
                                <EmptyState
                                    icon={Building2}
                                    title="Aucun département"
                                    description="Commencez par créer le premier département."
                                    action={<Button onClick={() => setEditing("new")}>Créer un département</Button>}
                                />
                            )
                        }
                        renderMobileCard={(row) => (
                            <div className="space-y-2">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="font-bold">{row.code} · {row.name}</p>
                                        <p className="text-sm text-gray-dark">{row.parent_name ? `Rattaché à ${row.parent_name}` : "Département racine"}</p>
                                    </div>
                                    <DepartmentActions department={row} />
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-sm">
                                    <ActiveBadge active={row.is_active} />
                                    <span>{row.employees_count} employé(s)</span>
                                    <span>{row.positions_count} poste(s)</span>
                                </div>
                            </div>
                        )}
                    />
                </div>
                <Pagination page={list.page} count={query.data?.count ?? 0} onPageChange={list.setPage} />
            </TabPanel>

            <TabPanel idPrefix="departments" id="tree" active={view === "tree"}>
                <DepartmentTreeView version={version} onEdit={setEditing} />
            </TabPanel>

            <DepartmentFormModal
                open={editing !== null}
                department={editing === "new" ? null : editing}
                tree={tree.data ?? []}
                onClose={() => setEditing(null)}
                onSaved={refresh}
            />

            <ConfirmDialog
                open={toggling !== null}
                onClose={() => setToggling(null)}
                title="Désactiver ce département ?"
                message={
                    <>
                        Le département <strong>{toggling?.name}</strong> ne pourra plus recevoir de nouveaux employés ni de nouveaux postes.
                        Il reste consultable et peut être réactivé.
                    </>
                }
                confirmLabel="Désactiver"
                onConfirm={async () => {
                    if (!toggling) return;
                    await setDepartmentActive(toggling.id, false);
                    notify.success("Département désactivé");
                    refresh();
                }}
            />

            <ConfirmDialog
                open={deleting !== null}
                onClose={() => setDeleting(null)}
                tone="danger"
                title="Supprimer ce département ?"
                message={
                    <>
                        <p>
                            Supprimer le département <strong>{deleting?.name}</strong> est irréversible.
                        </p>
                        <p className="mt-2 text-sm text-gray-dark">
                            Si des sous-départements, des postes ou des employés y sont rattachés, la suppression sera refusée :
                            désactivez-le plutôt.
                        </p>
                    </>
                }
                confirmLabel="Supprimer"
                onConfirm={async () => {
                    if (!deleting) return;
                    await deleteDepartment(deleting.id);
                    notify.success("Département supprimé");
                    // Last item of the page: go back one page.
                    if (query.data?.results.length === 1 && list.page > 1) list.setPage(list.page - 1);
                    refresh();
                }}
            />
        </>
    );
}