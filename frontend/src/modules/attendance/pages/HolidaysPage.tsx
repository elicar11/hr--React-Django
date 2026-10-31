import type { ColumnDef } from "@tanstack/react-table";
import { CalendarHeart, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
    Alert,
    Button,
    ConfirmDialog,
    DataTable,
    EmptyState,
    FilterBar,
    PageHeader,
    Pagination,
    RowActions,
    Select,
} from "@/components/ui";
import { formatDate } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useListParams } from "@/lib/hooks/useListParams";
import { notify } from "@/lib/notify";
import { HolidayFormModal } from "../components/HolidayFormModal";
import { deleteHoliday, listHolidays } from "../services/scheduleService";
import type { Holiday } from "../types";

const weekday = new Intl.DateTimeFormat("fr-FR", { weekday: "long" });

export function HolidaysPage() {
    const list = useListParams(["year"]);
    const currentYear = new Date().getFullYear();
    // Current year by default; "all" shows every year.
    const year = list.filters.year || String(currentYear);
    const [version, setVersion] = useState(0);
    const refresh = () => setVersion((current) => current + 1);
    const [editing, setEditing] = useState<Holiday | "new" | null>(null);
    const [deleting, setDeleting] = useState<Holiday | null>(null);

    const params = { page: list.page, ordering: "date", date__year: year === "all" ? undefined : year };
    const query = useApiQuery(["holidays", params, version], (signal) => listHolidays(params, signal));

    function Actions({ holiday }: { holiday: Holiday }) {
        return (
            <RowActions
                label={`Actions pour ${holiday.name}`}
                items={[
                    { label: "Modifier", icon: Pencil, onSelect: () => setEditing(holiday) },
                    { label: "Supprimer", icon: Trash2, tone: "danger", separatorBefore: true, onSelect: () => setDeleting(holiday) },
                ]}
            />
        );
    }

    const columns: ColumnDef<Holiday>[] = [
        { accessorKey: "date", header: "Date", cell: ({ row }) => <strong>{formatDate(row.original.date)}</strong> },
        {
            id: "weekday",
            header: "Jour",
            enableSorting: false,
            cell: ({ row }) => weekday.format(new Date(`${row.original.date}T00:00:00`)),
        },
        { accessorKey: "name", header: "Nom" },
        {
            id: "actions",
            header: () => <span className="sr-only">Actions</span>,
            enableSorting: false,
            cell: ({ row }) => <Actions holiday={row.original} />,
        },
    ];

    return (
        <>
            <PageHeader
                title="Jours fériés"
                description="Un jour férié est traité comme un jour non travaillé (retards, heures supplémentaires, congés). Aucun n'est préchargé : saisissez ceux de votre pays."
                actions={
                    <Button onClick={() => setEditing("new")} leftIcon={<Plus className="size-4" aria-hidden="true" />}>
                        Nouveau jour férié
                    </Button>
                }
            />
            <FilterBar>
                <Select label="Année" className="min-w-40" value={year} onChange={(e) => list.setFilter("year", e.target.value)}>
                    {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((value) => (
                        <option key={value} value={value}>
                            {value}
                        </option>
                    ))}
                    <option value="all">Toutes</option>
                </Select>
            </FilterBar>

            {query.error && <Alert tone="error" className="mb-4">{query.error.message}</Alert>}
            <div aria-busy={query.loading || undefined} className={query.loading && query.data ? "opacity-60" : undefined}>
                <DataTable
                    caption="Jours fériés"
                    columns={columns}
                    data={query.data?.results ?? []}
                    loading={query.loading && !query.data}
                    getRowId={(row) => String(row.id)}
                    emptyState={
                        <EmptyState
                            icon={CalendarHeart}
                            title="Aucun jour férié"
                            description="Ajoutez les jours fériés de l'année pour que les calculs de présences et de congés les excluent."
                            action={<Button onClick={() => setEditing("new")}>Ajouter un jour férié</Button>}
                        />
                    }
                    renderMobileCard={(row) => (
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="font-bold">{row.name}</p>
                                <p className="text-sm text-gray-dark">{weekday.format(new Date(`${row.date}T00:00:00`))} {formatDate(row.date)}</p>
                            </div>
                            <Actions holiday={row} />
                        </div>
                    )}
                />
            </div>
            <Pagination page={list.page} count={query.data?.count ?? 0} onPageChange={list.setPage} />

            <HolidayFormModal
                open={editing !== null}
                holiday={editing === "new" ? null : editing}
                onClose={() => setEditing(null)}
                onSaved={refresh}
            />
            <ConfirmDialog
                open={deleting !== null}
                onClose={() => setDeleting(null)}
                tone="danger"
                title="Supprimer ce jour férié ?"
                message={
                    <>
                        <strong>{deleting?.name}</strong> ({deleting ? formatDate(deleting.date) : ""}) ne sera plus traité comme un jour férié. Les
                        enregistrements déjà calculés ne changent pas.
                    </>
                }
                confirmLabel="Supprimer"
                onConfirm={async () => {
                    if (!deleting) return;
                    await deleteHoliday(deleting.id);
                    notify.success("Jour férié supprimé");
                    if (query.data?.results.length === 1 && list.page > 1) list.setPage(list.page - 1);
                    refresh();
                }}
            />
        </>
    );
}