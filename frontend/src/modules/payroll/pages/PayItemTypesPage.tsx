import type { ColumnDef } from "@tanstack/react-table";
import { Layers, Pencil, Plus, Power, PowerOff, Trash2 } from "lucide-react";
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
import { PayItemTypeFormModal } from "../components/PayItemTypeFormModal";
import { PayrollBanner } from "../components/PayrollBanner";
import { CALCULATION_LABELS, CATEGORY_LABELS } from "../payrollLabels";
import { deletePayItemType, listPayItemTypes, updatePayItemType } from "../services/payrollService";
import type { PayItemCalculation, PayItemCategory, PayItemType } from "../types";

export function PayItemTypesPage() {
    const list = useListParams(["category", "calculation", "applies_to_all", "is_active"]);
    const [version, setVersion] = useState(0);
    const refresh = () => setVersion((current) => current + 1);
    const [editing, setEditing] = useState<PayItemType | "new" | null>(null);
    const [deleting, setDeleting] = useState<PayItemType | null>(null);

    const params = {
        page: list.page,
        search: list.search || undefined,
        ordering: list.ordering || undefined,
        category: list.filters.category || undefined,
        calculation: list.filters.calculation || undefined,
        applies_to_all: list.filters.applies_to_all || undefined,
        is_active: list.filters.is_active || undefined,
    };
    const query = useApiQuery(["pay-item-types", params, version], (signal) => listPayItemTypes(params, signal));

    async function toggle(type: PayItemType) {
        try {
            await updatePayItemType(type.id, { is_active: !type.is_active });
            notify.success(type.is_active ? "Type désactivé" : "Type activé");
            refresh();
        } catch (error) {
            notify.error(error);
        }
    }

    function Actions({ type }: { type: PayItemType }) {
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

    function value(type: PayItemType) {
        if (type.default_rate !== null) return `${formatDecimal(type.default_rate, 4)} %`;
        if (type.default_amount !== null) return formatDecimal(type.default_amount);
        return "—";
    }

    const columns: ColumnDef<PayItemType>[] = [
        { accessorKey: "code", header: "Code", cell: ({ getValue }) => <strong>{String(getValue())}</strong> },
        { accessorKey: "name", header: "Nom" },
        { id: "category", header: "Catégorie", enableSorting: false, cell: ({ row }) => CATEGORY_LABELS[row.original.category] },
        { id: "calculation", header: "Calcul", enableSorting: false, cell: ({ row }) => CALCULATION_LABELS[row.original.calculation] },
        { id: "value", header: "Valeur par défaut", enableSorting: false, cell: ({ row }) => value(row.original) },
        {
            id: "all",
            header: "Application",
            enableSorting: false,
            cell: ({ row }) => (row.original.applies_to_all ? <Badge tone="solid">Tous les employés</Badge> : <Badge tone="muted">Par employé</Badge>),
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
                title="Types d'éléments de paie"
                description="Primes, indemnités, avantages, cotisations, impôts et retenues, et éléments calculés par le moteur."
                breadcrumb={[{ label: "Paie", to: "/payroll" }, { label: "Types d'éléments" }]}
                actions={
                    <Button onClick={() => setEditing("new")} leftIcon={<Plus className="size-4" aria-hidden="true" />}>
                        Nouveau type
                    </Button>
                }
            />
            <PayrollBanner />
            <Alert tone="info" className="mb-4">
                Les trois types « Calculé » (salaire de base, heures supplémentaires, congé sans solde) sont indispensables au moteur de calcul.
                Aucun taux, cotisation ou impôt n'est préchargé par l'application hors données de démonstration : ils dépendent de votre pays.
            </Alert>

            <FilterBar canReset={list.hasActiveFilters} onReset={list.reset}>
                <SearchInput className="w-full max-w-xs" value={list.searchText} onChange={list.setSearchText} placeholder="Code ou nom…" />
                <Select label="Catégorie" className="min-w-48" value={list.filters.category} placeholder="Toutes" onChange={(e) => list.setFilter("category", e.target.value)}>
                    {(Object.keys(CATEGORY_LABELS) as PayItemCategory[]).map((category) => (
                        <option key={category} value={category}>
                            {CATEGORY_LABELS[category]}
                        </option>
                    ))}
                </Select>
                <Select label="Calcul" className="min-w-56" value={list.filters.calculation} placeholder="Tous" onChange={(e) => list.setFilter("calculation", e.target.value)}>
                    {(Object.keys(CALCULATION_LABELS) as PayItemCalculation[]).map((calculation) => (
                        <option key={calculation} value={calculation}>
                            {CALCULATION_LABELS[calculation]}
                        </option>
                    ))}
                </Select>
                <Select label="Application" className="min-w-44" value={list.filters.applies_to_all} placeholder="Toutes" onChange={(e) => list.setFilter("applies_to_all", e.target.value)}>
                    <option value="true">Tous les employés</option>
                    <option value="false">Par employé</option>
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
                    caption="Types d'éléments de paie"
                    columns={columns}
                    data={query.data?.results ?? []}
                    loading={query.loading && !query.data}
                    getRowId={(row) => String(row.id)}
                    sorting={list.sorting}
                    onSortingChange={list.setSorting}
                    emptyState={
                        <EmptyState
                            icon={Layers}
                            title={list.hasActiveFilters ? "Aucun résultat" : "Aucun type d'élément"}
                            description={list.hasActiveFilters ? "Aucun type ne correspond à ces critères." : "Pour des données de démonstration, lancez `python manage.py seed_demo_payroll --currency XXX` dans le backend."}
                            action={list.hasActiveFilters ? <Button variant="secondary" onClick={list.reset}>Réinitialiser les filtres</Button> : <Button onClick={() => setEditing("new")}>Créer un type</Button>}
                        />
                    }
                    renderMobileCard={(row) => (
                        <div className="space-y-2">
                            <div className="flex items-start justify-between gap-3">
                                <p className="font-bold">{row.code} · {row.name}</p>
                                <Actions type={row} />
                            </div>
                            <p className="text-sm text-gray-dark">{CATEGORY_LABELS[row.category]} · {CALCULATION_LABELS[row.calculation]}</p>
                            <ActiveBadge active={row.is_active} />
                        </div>
                    )}
                />
            </div>
            <Pagination page={list.page} count={query.data?.count ?? 0} onPageChange={list.setPage} />

            <PayItemTypeFormModal open={editing !== null} payItemType={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={refresh} />
            <ConfirmDialog
                open={deleting !== null}
                onClose={() => setDeleting(null)}
                tone="danger"
                title="Supprimer ce type ?"
                message={
                    <>
                        <p>Supprimer le type <strong>{deleting?.name}</strong> est irréversible.</p>
                        <p className="mt-2 text-sm text-gray-dark">S'il est utilisé par des éléments ou des bulletins, la suppression sera refusée : désactivez-le plutôt.</p>
                    </>
                }
                confirmLabel="Supprimer"
                onConfirm={async () => {
                    if (!deleting) return;
                    await deletePayItemType(deleting.id);
                    notify.success("Type supprimé");
                    if (query.data?.results.length === 1 && list.page > 1) list.setPage(list.page - 1);
                    refresh();
                }}
            />
        </>
    );
}