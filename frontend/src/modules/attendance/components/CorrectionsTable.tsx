import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { DataTable, StatusBadge } from "@/components/ui";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";
import type { AttendanceCorrection } from "../types";

function Proposed({ correction }: { correction: AttendanceCorrection }) {
    return (
        <span>
            {formatTime(correction.check_in)} → {correction.check_out ? formatTime(correction.check_out) : "—"}
        </span>
    );
}

function Decision({ correction }: { correction: AttendanceCorrection }) {
    if (!correction.decision_comment) return null;
    return <p className="mt-1 text-sm text-gray-dark">Commentaire : {correction.decision_comment}</p>;
}

/** Correction requests, for the HR queue (with employee) and for the employee's own list. */
export function CorrectionsTable({
    rows,
    loading,
    showEmployee,
    renderActions,
    emptyState,
}: {
    rows: AttendanceCorrection[];
    loading: boolean;
    showEmployee: boolean;
    renderActions: (correction: AttendanceCorrection) => ReactNode;
    emptyState: ReactNode;
}) {
    const columns: ColumnDef<AttendanceCorrection>[] = [
        {
            id: "created_at",
            header: "Demandée le",
            enableSorting: false,
            cell: ({ row }) => formatDateTime(row.original.created_at),
        },
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
            ] satisfies ColumnDef<AttendanceCorrection>[])
            : []),
        { id: "date", header: "Jour", enableSorting: false, cell: ({ row }) => <strong>{formatDate(row.original.date)}</strong> },
        { id: "proposed", header: "Horaires proposés", enableSorting: false, cell: ({ row }) => <Proposed correction={row.original} /> },
        {
            id: "reason",
            header: "Motif",
            enableSorting: false,
            cell: ({ row }) => (
                <div className="max-w-xs">
                    <p>{row.original.reason}</p>
                    <Decision correction={row.original} />
                </div>
            ),
        },
        {
            id: "status",
            header: "Statut",
            enableSorting: false,
            cell: ({ row }) => <StatusBadge domain="correction" status={row.original.status} />,
        },
        {
            id: "actions",
            header: () => <span className="sr-only">Actions</span>,
            enableSorting: false,
            cell: ({ row }) => renderActions(row.original),
        },
    ];

    return (
        <DataTable
            caption="Demandes de correction de pointage"
            columns={columns}
            data={rows}
            loading={loading}
            getRowId={(row) => String(row.id)}
            emptyState={emptyState}
            renderMobileCard={(row) => (
                <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="font-bold">{formatDate(row.date)}</p>
                            {showEmployee && <p className="text-sm text-gray-dark">{row.employee_name}</p>}
                            <p className="text-sm">
                                <Proposed correction={row} />
                            </p>
                        </div>
                        <StatusBadge domain="correction" status={row.status} />
                    </div>
                    <p className="text-sm">{row.reason}</p>
                    <Decision correction={row} />
                    {renderActions(row)}
                </div>
            )}
        />
    );
}