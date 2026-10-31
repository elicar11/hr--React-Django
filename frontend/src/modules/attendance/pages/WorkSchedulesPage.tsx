import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Star, Timer, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import {
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
    TabPanel,
    Tabs,
} from "@/components/ui";
import { formatDate } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useListParams } from "@/lib/hooks/useListParams";
import { notify } from "@/lib/notify";
import { EmployeeFilterChip } from "@/modules/employees/components/EmployeeFilterChip";
import { AssignScheduleModal } from "../components/AssignScheduleModal";
import { ScheduleFormModal } from "../components/ScheduleFormModal";
import {
    deleteSchedule,
    getAllSchedules,
    listAssignments,
    listSchedules,
    setDefaultSchedule,
} from "../services/scheduleService";
import type { ScheduleAssignment, WorkSchedule } from "../types";
import { formatWorkingDays } from "../weekdays";

type ListParams = ReturnType<typeof useListParams>;

const VIEWS = [
    { id: "schedules", label: "Horaires" },
    { id: "assignments", label: "Affectations" },
];

const assignmentColumns: ColumnDef<ScheduleAssignment>[] = [
    {
        id: "employee", header: "Employé", enableSorting: false, cell: ({ row }) => (
            <Link to={`/employees/${row.original.employee}`} className="font-bold underline underline-offset-4 hover:bg-ink hover:text-paper">
                {row.original.employee_matricule}
            </Link>
        )
    },
    { id: "schedule_code", header: "Horaire", enableSorting: false, cell: ({ row }) => <Badge tone="outline">{row.original.schedule_code}</Badge> },
    { accessorKey: "start_date", header: "Début", cell: ({ row }) => formatDate(row.original.start_date) },
    {
        accessorKey: "end_date",
        header: "Fin",
        cell: ({ row }) => (row.original.end_date ? formatDate(row.original.end_date) : <Badge tone="solid">En cours</Badge>),
    },
];

function SchedulesView({ list, version, onEdit, onDelete, onChanged }: {
    list: ListParams;
    version: number;
    onEdit: (schedule: WorkSchedule) => void;
    onDelete: (schedule: WorkSchedule) => void;
    onChanged: () => void;
}) {
    const params = { page: list.page, search: list.search || undefined, ordering: list.ordering || undefined };
    const query = useApiQuery(["schedules", params, version], (signal) => listSchedules(params, signal));

    async function makeDefault(schedule: WorkSchedule) {
        try {
            await setDefaultSchedule(schedule.id);
            notify.success("Horaire par défaut défini", schedule.name);
            onChanged();
        } catch (error) {
            notify.error(error);
        }
    }

    function Actions({ schedule }: { schedule: WorkSchedule }) {
        return (
            <RowActions
                label={`Actions pour ${schedule.name}`}
                items={[
                    { label: "Modifier", icon: Pencil, onSelect: () => onEdit(schedule) },
                    { label: "Définir par défaut", icon: Star, disabled: schedule.is_default, onSelect: () => void makeDefault(schedule) },
                    { label: "Supprimer", icon: Trash2, tone: "danger", separatorBefore: true, onSelect: () => onDelete(schedule) },
                ]}
            />
        );
    }

    const columns: ColumnDef<WorkSchedule>[] = [
        { accessorKey: "code", header: "Code", cell: ({ getValue }) => <strong>{String(getValue())}</strong> },
        { accessorKey: "name", header: "Nom" },
        {
            id: "hours",
            header: "Horaires",
            enableSorting: false,
            cell: ({ row }) => (
                <span>
                    {row.original.start_time.slice(0, 5)} – {row.original.end_time.slice(0, 5)}
                    {row.original.break_start && row.original.break_end && (
                        <span className="block text-sm text-gray-dark">
                            Pause {row.original.break_start.slice(0, 5)} – {row.original.break_end.slice(0, 5)}
                        </span>
                    )}
                </span>
            ),
        },
        { id: "days", header: "Jours", enableSorting: false, cell: ({ row }) => formatWorkingDays(row.original.working_days) },
        {
            id: "rules",
            header: "Tolérance / seuil HS",
            enableSorting: false,
            cell: ({ row }) => `${row.original.late_grace_minutes} min / ${row.original.overtime_threshold_minutes} min`,
        },
        {
            id: "is_default",
            header: "Défaut",
            enableSorting: false,
            cell: ({ row }) => (row.original.is_default ? <Badge tone="solid" icon={Star}>Par défaut</Badge> : "—"),
        },
        {
            id: "actions",
            header: () => <span className="sr-only">Actions</span>,
            enableSorting: false,
            cell: ({ row }) => <Actions schedule={row.original} />,
        },
    ];

    return (
        <>
            <FilterBar canReset={list.search !== ""} onReset={list.reset}>
                <SearchInput className="w-full max-w-xs" value={list.searchText} onChange={list.setSearchText} placeholder="Code ou nom…" />
            </FilterBar>
            {query.error && <Alert tone="error" className="mb-4">{query.error.message}</Alert>}
            <div aria-busy={query.loading || undefined} className={query.loading && query.data ? "opacity-60" : undefined}>
                <DataTable
                    caption="Horaires de travail"
                    columns={columns}
                    data={query.data?.results ?? []}
                    loading={query.loading && !query.data}
                    getRowId={(row) => String(row.id)}
                    sorting={list.sorting}
                    onSortingChange={list.setSorting}
                    emptyState={
                        <EmptyState
                            icon={Timer}
                            title="Aucun horaire de travail"
                            description="Sans horaire (par défaut ou affecté), les employés ne peuvent pas pointer. Créez-en un puis définissez-le par défaut."
                        />
                    }
                    renderMobileCard={(row) => (
                        <div className="space-y-1">
                            <div className="flex items-start justify-between gap-3">
                                <p className="font-bold">{row.code} · {row.name}</p>
                                <Actions schedule={row} />
                            </div>
                            <p className="text-sm">{row.start_time.slice(0, 5)} – {row.end_time.slice(0, 5)} · {formatWorkingDays(row.working_days)}</p>
                            {row.is_default && <Badge tone="solid" icon={Star}>Par défaut</Badge>}
                        </div>
                    )}
                />
            </div>
            <Pagination page={list.page} count={query.data?.count ?? 0} onPageChange={list.setPage} />
        </>
    );
}

function AssignmentsView({ list, version }: { list: ListParams; version: number }) {
    const params = {
        page: list.page,
        ordering: "-start_date",
        employee: list.filters.employee || undefined,
        schedule: list.filters.schedule || undefined,
    };
    const query = useApiQuery(["schedule-assignments", params, version], (signal) => listAssignments(params, signal));
    const schedules = useApiQuery(["schedules-all", version], (signal) => getAllSchedules(signal));
    const employeeId = Number(list.filters.employee) || null;

    return (
        <>
            <FilterBar canReset={list.hasActiveFilters} onReset={list.reset}>
                <Select label="Horaire" className="min-w-48" value={list.filters.schedule} placeholder="Tous" onChange={(e) => list.setFilter("schedule", e.target.value)}>
                    {(schedules.data ?? []).map((schedule) => (
                        <option key={schedule.id} value={schedule.id}>
                            {schedule.code} · {schedule.name}
                        </option>
                    ))}
                </Select>
                {employeeId && <EmployeeFilterChip employeeId={employeeId} onClear={() => list.setFilter("employee", "")} />}
            </FilterBar>
            {query.error && <Alert tone="error" className="mb-4">{query.error.message}</Alert>}
            <div aria-busy={query.loading || undefined} className={query.loading && query.data ? "opacity-60" : undefined}>
                <DataTable
                    caption="Affectations d'horaires"
                    columns={assignmentColumns}
                    data={query.data?.results ?? []}
                    loading={query.loading && !query.data}
                    getRowId={(row) => String(row.id)}
                    emptyState={
                        <EmptyState
                            icon={Users}
                            title="Aucune affectation"
                            description="Les employés sans affectation suivent l'horaire par défaut."
                        />
                    }
                />
            </div>
            <Pagination page={list.page} count={query.data?.count ?? 0} onPageChange={list.setPage} />
        </>
    );
}

export function WorkSchedulesPage() {
    const list = useListParams(["employee", "schedule"]);
    const view = list.getParam("view") === "assignments" ? "assignments" : "schedules";
    const [version, setVersion] = useState(0);
    const refresh = () => setVersion((current) => current + 1);
    const [editing, setEditing] = useState<WorkSchedule | "new" | null>(null);
    const [deleting, setDeleting] = useState<WorkSchedule | null>(null);
    const [assigning, setAssigning] = useState(false);

    return (
        <>
            <PageHeader
                title="Horaires de travail"
                description="Horaires, tolérances et affectations aux employés."
                actions={
                    view === "schedules" ? (
                        <Button onClick={() => setEditing("new")} leftIcon={<Plus className="size-4" aria-hidden="true" />}>
                            Nouvel horaire
                        </Button>
                    ) : (
                        <Button onClick={() => setAssigning(true)} leftIcon={<Plus className="size-4" aria-hidden="true" />}>
                            Affecter un horaire
                        </Button>
                    )
                }
            />
            <Tabs
                idPrefix="schedules"
                label="Affichage des horaires"
                items={VIEWS}
                value={view}
                onChange={(id) => list.setParams({ view: id === "schedules" ? undefined : id, page: undefined })}
            />
            <TabPanel idPrefix="schedules" id="schedules" active={view === "schedules"}>
                <SchedulesView list={list} version={version} onEdit={setEditing} onDelete={setDeleting} onChanged={refresh} />
            </TabPanel>
            <TabPanel idPrefix="schedules" id="assignments" active={view === "assignments"}>
                <AssignmentsView list={list} version={version} />
            </TabPanel>

            <ScheduleFormModal
                open={editing !== null}
                schedule={editing === "new" ? null : editing}
                onClose={() => setEditing(null)}
                onSaved={refresh}
            />
            <AssignScheduleModal open={assigning} onClose={() => setAssigning(false)} onSaved={refresh} />
            <ConfirmDialog
                open={deleting !== null}
                onClose={() => setDeleting(null)}
                tone="danger"
                title="Supprimer cet horaire ?"
                message={
                    <>
                        <p>
                            Supprimer l'horaire <strong>{deleting?.name}</strong> est irréversible.
                        </p>
                        <p className="mt-2 text-sm text-gray-dark">S'il est utilisé par des affectations ou des relevés, la suppression sera refusée.</p>
                    </>
                }
                confirmLabel="Supprimer"
                onConfirm={async () => {
                    if (!deleting) return;
                    await deleteSchedule(deleting.id);
                    notify.success("Horaire supprimé");
                    refresh();
                }}
            />
        </>
    );
}