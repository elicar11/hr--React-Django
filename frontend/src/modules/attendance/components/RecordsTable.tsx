import type { ColumnDef, OnChangeFn, SortingState } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Badge, DataTable, RowActions, StatusBadge } from "@/components/ui";
import { formatDate, formatMinutes, formatTime } from "@/lib/format";
import type { AttendanceRecord } from "../types";

const SOURCES: Record<string, string> = { CLOCK: "Pointage", MANUAL: "Saisie RH", SYSTEM: "Système" };

function minutes(value: number, show: boolean) {
    return show && value > 0 ? formatMinutes(value) : "—";
}

export function RecordsTable({
    caption,
    rows,
    loading,
    showEmployee,
    sorting,
    onSortingChange,
    onEdit,
    onDelete,
    emptyState,
}: {
    caption: string;
    rows: AttendanceRecord[];
    loading: boolean;
    showEmployee: boolean;
    sorting?: SortingState;
    onSortingChange?: OnChangeFn<SortingState>;
    /** ADMIN / HR only. */
    onEdit?: (record: AttendanceRecord) => void;
    onDelete?: (record: AttendanceRecord) => void;
    emptyState: ReactNode;
}) {
    const present = (record: AttendanceRecord) => record.status === "PRESENT";

    function Actions({ record }: { record: AttendanceRecord }) {
        if (!onEdit && !onDelete) return null;
        return (
            <RowActions
                label={`Actions pour le ${formatDate(record.date)}`}
                items={[
                    ...(onEdit ? [{ label: "Modifier", icon: Pencil, onSelect: () => onEdit(record) }] : []),
                    // A presence is corrected, never erased: only absences can be deleted.
                    ...(onDelete && !present(record)
                        ? [{ label: "Supprimer l'absence", icon: Trash2, tone: "danger" as const, separatorBefore: true, onSelect: () => onDelete(record) }]
                        : []),
                ]}
            />
        );
    }

    const columns: ColumnDef<AttendanceRecord>[] = [
        { accessorKey: "date", header: "Date", cell: ({ row }) => <strong>{formatDate(row.original.date)}</strong> },
        ...(showEmployee
            ? ([
                {
                    id: "employee_name",
                    header: "Employé",
                    enableSorting: false,
                    cell: ({ row }) => (
                        <Link to={`/employees/${row.original.employee}`} className="underline underline-offset-4 hover:bg-ink hover:text-paper">
                            {row.original.employee_name}
                        </Link>
                    ),
                },
                { id: "department_name", header: "Département", enableSorting: false, cell: ({ row }) => row.original.department_name },
            ] satisfies ColumnDef<AttendanceRecord>[])
            : []),
        {
            id: "status",
            header: "Statut",
            enableSorting: false,
            cell: ({ row }) => <StatusBadge domain="attendance" status={row.original.status} />,
        },
        { id: "check_in", header: "Entrée", enableSorting: false, cell: ({ row }) => formatTime(row.original.check_in) || "—" },
        { id: "check_out", header: "Sortie", enableSorting: false, cell: ({ row }) => formatTime(row.original.check_out) || "—" },
        {
            accessorKey: "worked_minutes",
            header: "Travaillé",
            cell: ({ row }) => minutes(row.original.worked_minutes, present(row.original) && !!row.original.check_out),
        },
        {
            accessorKey: "late_minutes",
            header: "Retard",
            cell: ({ row }) =>
                row.original.late_minutes > 0 ? <Badge tone="alert">{formatMinutes(row.original.late_minutes)}</Badge> : "—",
        },
        {
            accessorKey: "overtime_minutes",
            header: "Heures sup",
            cell: ({ row }) => minutes(row.original.overtime_minutes, true),
        },
        {
            id: "source",
            header: "Source",
            enableSorting: false,
            cell: ({ row }) => <Badge tone="muted">{SOURCES[row.original.source] ?? row.original.source}</Badge>,
        },
        ...(onEdit || onDelete
            ? ([
                {
                    id: "actions",
                    header: () => <span className="sr-only">Actions</span>,
                    enableSorting: false,
                    cell: ({ row }) => <Actions record={row.original} />,
                },
            ] satisfies ColumnDef<AttendanceRecord>[])
            : []),
    ];

    return (
        <DataTable
            caption={caption}
            columns={columns}
            data={rows}
            loading={loading}
            getRowId={(row) => String(row.id)}
            sorting={sorting}
            onSortingChange={onSortingChange}
            emptyState={emptyState}
            renderMobileCard={(row) => (
                <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="font-bold">{formatDate(row.date)}</p>
                            {showEmployee && <p className="text-sm text-gray-dark">{row.employee_name}</p>}
                        </div>
                        <Actions record={row} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge domain="attendance" status={row.status} />
                        {row.late_minutes > 0 && <Badge tone="alert">Retard {formatMinutes(row.late_minutes)}</Badge>}
                    </div>
                    {present(row) && (
                        <p className="text-sm">
                            {formatTime(row.check_in) || "—"} → {formatTime(row.check_out) || "en cours"}
                            {row.check_out && ` · ${formatMinutes(row.worked_minutes)}`}
                        </p>
                    )}
                </div>
            )}
        />
    );
}