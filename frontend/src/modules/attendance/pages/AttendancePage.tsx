import type { ColumnDef } from "@tanstack/react-table";
import { CalendarCheck, Download, Plus } from "lucide-react";
import { useState } from "react";
import {
    Alert,
    Button,
    ConfirmDialog,
    DataTable,
    DateField,
    EmptyState,
    FilterBar,
    PageHeader,
    Pagination,
    SearchInput,
    Select,
    TabPanel,
    Tabs,
} from "@/components/ui";
import { saveFile } from "@/lib/download";
import { firstOfMonthISO, formatMinutes, todayISO } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useListParams } from "@/lib/hooks/useListParams";
import { notify } from "@/lib/notify";
import { EmployeeFilterChip } from "@/modules/employees/components/EmployeeFilterChip";
import { flattenDepartments, getDepartmentTree } from "@/modules/organization/services/organizationService";
import { CorrectionsQueue } from "../components/CorrectionsQueue";
import { RecordFormModal } from "../components/RecordFormModal";
import { RecordsTable } from "../components/RecordsTable";
import {
    deleteAttendanceRecord,
    exportAttendance,
    getAttendanceSummary,
    listAttendance,
} from "../services/attendanceService";
import type { AttendanceRecord, AttendanceSummaryRow } from "../types";

type ListParams = ReturnType<typeof useListParams>;

const FILTER_KEYS = [
    "employee", "department", "status", "source", "late", "has_overtime",
    "date_from", "date_to", "correction_status",
] as const;

const VIEWS = [
    { id: "records", label: "Relevés" },
    { id: "summary", label: "Synthèse" },
    { id: "corrections", label: "Corrections" },
];

/** Without dates, the current month is shown. */
function useRange(list: ListParams) {
    return {
        dateFrom: list.filters.date_from || firstOfMonthISO(),
        dateTo: list.filters.date_to || todayISO(),
    };
}

function PeriodFilters({ list, departments }: { list: ListParams; departments: { id: number; label: string }[] }) {
    const { dateFrom, dateTo } = useRange(list);
    const employeeId = Number(list.filters.employee) || null;
    return (
        <>
            <SearchInput className="w-full max-w-xs" value={list.searchText} onChange={list.setSearchText} placeholder="Matricule, nom…" />
            <DateField label="Du" value={dateFrom} max={dateTo} onChange={(e) => list.setFilter("date_from", e.target.value)} />
            <DateField label="Au" value={dateTo} min={dateFrom} onChange={(e) => list.setFilter("date_to", e.target.value)} />
            <Select label="Département" className="min-w-56" value={list.filters.department} placeholder="Tous" onChange={(e) => list.setFilter("department", e.target.value)}>
                {departments.map((option) => (
                    <option key={option.id} value={option.id}>
                        {option.label}
                    </option>
                ))}
            </Select>
            {employeeId && <EmployeeFilterChip employeeId={employeeId} onClear={() => list.setFilter("employee", "")} />}
        </>
    );
}

function RecordsView({ list, departments, version, onEdit, onDelete }: {
    list: ListParams;
    departments: { id: number; label: string }[];
    version: number;
    onEdit: (record: AttendanceRecord) => void;
    onDelete: (record: AttendanceRecord) => void;
}) {
    const { dateFrom, dateTo } = useRange(list);
    const params = {
        page: list.page,
        search: list.search || undefined,
        ordering: list.ordering || undefined,
        employee: list.filters.employee || undefined,
        department: list.filters.department || undefined,
        status: list.filters.status || undefined,
        source: list.filters.source || undefined,
        late: list.filters.late || undefined,
        has_overtime: list.filters.has_overtime || undefined,
        date_from: dateFrom,
        date_to: dateTo,
    };
    const query = useApiQuery(["attendance", params, version], (signal) => listAttendance(params, signal));

    return (
        <>
            <FilterBar canReset={list.hasActiveFilters} onReset={list.reset}>
                <PeriodFilters list={list} departments={departments} />
                <Select label="Statut" className="min-w-48" value={list.filters.status} placeholder="Tous" onChange={(e) => list.setFilter("status", e.target.value)}>
                    <option value="PRESENT">Présent</option>
                    <option value="ABSENT_JUSTIFIED">Absence justifiée</option>
                    <option value="ABSENT_UNJUSTIFIED">Absence injustifiée</option>
                </Select>
                <Select label="Source" className="min-w-40" value={list.filters.source} placeholder="Toutes" onChange={(e) => list.setFilter("source", e.target.value)}>
                    <option value="CLOCK">Pointage</option>
                    <option value="MANUAL">Saisie RH</option>
                    <option value="SYSTEM">Système</option>
                </Select>
                <Select label="Retards" className="min-w-40" value={list.filters.late} placeholder="Tous" onChange={(e) => list.setFilter("late", e.target.value)}>
                    <option value="true">En retard</option>
                    <option value="false">À l'heure</option>
                </Select>
                <Select label="Heures sup" className="min-w-40" value={list.filters.has_overtime} placeholder="Tous" onChange={(e) => list.setFilter("has_overtime", e.target.value)}>
                    <option value="true">Avec heures sup</option>
                    <option value="false">Sans</option>
                </Select>
            </FilterBar>

            {query.error && (
                <Alert tone="error" title="Impossible de charger les relevés" className="mb-4">
                    <p>{query.error.message}</p>
                    <Button size="sm" variant="secondary" className="mt-2" onClick={query.reload}>
                        Réessayer
                    </Button>
                </Alert>
            )}

            <div aria-busy={query.loading || undefined} className={query.loading && query.data ? "opacity-60" : undefined}>
                <RecordsTable
                    caption="Relevés de présence"
                    rows={query.data?.results ?? []}
                    loading={query.loading && !query.data}
                    showEmployee
                    sorting={list.sorting}
                    onSortingChange={list.setSorting}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    emptyState={
                        <EmptyState
                            icon={CalendarCheck}
                            title="Aucun enregistrement"
                            description="Aucune présence ni absence ne correspond à ces critères sur la période."
                        />
                    }
                />
            </div>
            <Pagination page={list.page} count={query.data?.count ?? 0} onPageChange={list.setPage} />
        </>
    );
}

const summaryColumns: ColumnDef<AttendanceSummaryRow>[] = [
    {
        id: "employee",
        header: "Employé",
        enableSorting: false,
        cell: ({ row }) => (
            <span>
                <strong>
                    {row.original.last_name} {row.original.first_name}
                </strong>{" "}
                <span className="text-gray-dark">({row.original.matricule})</span>
            </span>
        ),
    },
    { accessorKey: "days_present", header: "Jours présents", enableSorting: false },
    { accessorKey: "days_absent_justified", header: "Abs. justifiées", enableSorting: false },
    { accessorKey: "days_absent_unjustified", header: "Abs. injustifiées", enableSorting: false },
    {
        id: "late",
        header: "Retards",
        enableSorting: false,
        cell: ({ row }) =>
            row.original.late_count > 0
                ? `${row.original.late_count} (${formatMinutes(row.original.total_late_minutes)})`
                : "—",
    },
    { id: "worked", header: "Travaillé", enableSorting: false, cell: ({ row }) => formatMinutes(row.original.total_worked_minutes) },
    {
        id: "overtime",
        header: "Heures sup",
        enableSorting: false,
        cell: ({ row }) => (row.original.total_overtime_minutes > 0 ? formatMinutes(row.original.total_overtime_minutes) : "—"),
    },
];

function SummaryView({ list, departments }: { list: ListParams; departments: { id: number; label: string }[] }) {
    const { dateFrom, dateTo } = useRange(list);
    const params = {
        page: list.page,
        search: list.search || undefined,
        employee: list.filters.employee || undefined,
        department: list.filters.department || undefined,
        date_from: dateFrom,
        date_to: dateTo,
    };
    const query = useApiQuery(["attendance-summary", params], (signal) => getAttendanceSummary(params, signal));

    return (
        <>
            <FilterBar canReset={list.hasActiveFilters} onReset={list.reset}>
                <PeriodFilters list={list} departments={departments} />
            </FilterBar>
            {query.error && (
                <Alert tone="error" title="Impossible de charger la synthèse" className="mb-4">
                    <p>{query.error.message}</p>
                </Alert>
            )}
            <div aria-busy={query.loading || undefined} className={query.loading && query.data ? "opacity-60" : undefined}>
                <DataTable
                    caption="Synthèse des présences par employé"
                    columns={summaryColumns}
                    data={query.data?.results ?? []}
                    loading={query.loading && !query.data}
                    getRowId={(row) => String(row.employee_id)}
                    emptyState={<EmptyState icon={CalendarCheck} title="Aucune donnée" description="Aucun enregistrement sur cette période." />}
                    renderMobileCard={(row) => (
                        <div className="space-y-1">
                            <p className="font-bold">
                                {row.last_name} {row.first_name} <span className="font-normal text-gray-dark">({row.matricule})</span>
                            </p>
                            <p className="text-sm">
                                {row.days_present} j présent · {row.days_absent_justified} abs. justifiée(s) · {row.days_absent_unjustified} injustifiée(s)
                            </p>
                            <p className="text-sm text-gray-dark">
                                Travaillé {formatMinutes(row.total_worked_minutes)} · {row.late_count} retard(s) · heures sup {formatMinutes(row.total_overtime_minutes)}
                            </p>
                        </div>
                    )}
                />
            </div>
            <Pagination page={list.page} count={query.data?.count ?? 0} onPageChange={list.setPage} />
        </>
    );
}

export function AttendancePage() {
    const list = useListParams(FILTER_KEYS);
    const view = list.getParam("view") === "summary" ? "summary" : list.getParam("view") === "corrections" ? "corrections" : "records";
    const [version, setVersion] = useState(0);
    const refresh = () => setVersion((current) => current + 1);
    const [editing, setEditing] = useState<AttendanceRecord | "new" | null>(null);
    const [deleting, setDeleting] = useState<AttendanceRecord | null>(null);
    const [exporting, setExporting] = useState(false);

    const tree = useApiQuery(["departments-tree"], (signal) => getDepartmentTree(signal));
    const departments = flattenDepartments(tree.data ?? []);
    const { dateFrom, dateTo } = useRange(list);

    async function handleExport() {
        setExporting(true);
        try {
            saveFile(
                await exportAttendance({
                    search: list.search || undefined,
                    ordering: list.ordering || undefined,
                    employee: list.filters.employee || undefined,
                    department: list.filters.department || undefined,
                    status: list.filters.status || undefined,
                    source: list.filters.source || undefined,
                    late: list.filters.late || undefined,
                    has_overtime: list.filters.has_overtime || undefined,
                    date_from: dateFrom,
                    date_to: dateTo,
                }),
            );
            notify.success("Export téléchargé", "Les motifs d'absence n'y figurent pas.");
        } catch (error) {
            notify.error(error);
        } finally {
            setExporting(false);
        }
    }

    return (
        <>
            <PageHeader
                title="Présences"
                description="Relevés, synthèse par employé et corrections de pointage."
                actions={
                    <>
                        <Button variant="secondary" onClick={() => void handleExport()} loading={exporting} leftIcon={<Download className="size-4" aria-hidden="true" />}>
                            Exporter
                        </Button>
                        <Button onClick={() => setEditing("new")} leftIcon={<Plus className="size-4" aria-hidden="true" />}>
                            Saisir
                        </Button>
                    </>
                }
            />
            <Tabs
                idPrefix="attendance"
                label="Affichage des présences"
                items={VIEWS}
                value={view}
                onChange={(id) => list.setParams({ view: id === "records" ? undefined : id, page: undefined })}
            />
            <TabPanel idPrefix="attendance" id="records" active={view === "records"}>
                <RecordsView list={list} departments={departments} version={version} onEdit={setEditing} onDelete={setDeleting} />
            </TabPanel>
            <TabPanel idPrefix="attendance" id="summary" active={view === "summary"}>
                <SummaryView list={list} departments={departments} />
            </TabPanel>
            <TabPanel idPrefix="attendance" id="corrections" active={view === "corrections"}>
                <CorrectionsQueue list={list} />
            </TabPanel>

            <RecordFormModal
                open={editing !== null}
                record={editing === "new" ? null : editing}
                onClose={() => setEditing(null)}
                onSaved={refresh}
            />
            <ConfirmDialog
                open={deleting !== null}
                onClose={() => setDeleting(null)}
                tone="danger"
                title="Supprimer cette absence ?"
                message={
                    <>
                        L'absence de <strong>{deleting?.employee_name}</strong> sera supprimée. Une présence ne peut pas être supprimée :
                        elle se corrige.
                    </>
                }
                confirmLabel="Supprimer"
                onConfirm={async () => {
                    if (!deleting) return;
                    await deleteAttendanceRecord(deleting.id);
                    notify.success("Absence supprimée");
                    refresh();
                }}
            />
        </>
    );
}