import type { ColumnDef, OnChangeFn, SortingState } from "@tanstack/react-table";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { DataTable, RowActions, StatusBadge, type MenuItem } from "@/components/ui";
import { formatDate, formatDecimal } from "@/lib/format";
import type { LeaveRequest } from "../types";

export function LeaveRequestsTable({
    caption,
    rows,
    loading,
    showEmployee,
    sorting,
    onSortingChange,
    getActions,
    emptyState,
}: {
    caption: string;
    rows: LeaveRequest[];
    loading: boolean;
    showEmployee: boolean;
    sorting?: SortingState;
    onSortingChange?: OnChangeFn<SortingState>;
    getActions: (leave: LeaveRequest) => MenuItem[];
    emptyState: ReactNode;
}) {
    const actions = (leave: LeaveRequest) => (
        <RowActions label={`Actions pour la demande du ${formatDate(leave.start_date)}`} items={getActions(leave)} />
    );

    const columns: ColumnDef<LeaveRequest>[] = [
        {
            accessorKey: "created_at",
            header: "Demandée le",
            cell: ({ row }) => formatDate(row.original.created_at),
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
            ] satisfies ColumnDef<LeaveRequest>[])
            : []),
        { id: "leave_type_name", header: "Type", enableSorting: false, cell: ({ row }) => row.original.leave_type_name },
        {
            accessorKey: "start_date",
            header: "Période",
            cell: ({ row }) => (
                <Link to={`/leaves/${row.original.id}`} className="font-bold underline underline-offset-4 hover:bg-ink hover:text-paper">
                    {formatDate(row.original.start_date)} → {formatDate(row.original.end_date)}
                </Link>
            ),
        },
        { accessorKey: "days", header: "Jours", cell: ({ row }) => formatDecimal(row.original.days) },
        {
            id: "status",
            header: "Statut",
            enableSorting: false,
            cell: ({ row }) => <StatusBadge domain="leave" status={row.original.status} />,
        },
        { id: "actions", header: () => <span className="sr-only">Actions</span>, enableSorting: false, cell: ({ row }) => actions(row.original) },
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
                            <Link to={`/leaves/${row.id}`} className="font-bold underline underline-offset-4">
                                {formatDate(row.start_date)} → {formatDate(row.end_date)}
                            </Link>
                            {showEmployee && <p className="text-sm text-gray-dark">{row.employee_name}</p>}
                            <p className="text-sm text-gray-dark">
                                {row.leave_type_name} · {formatDecimal(row.days)} j
                            </p>
                        </div>
                        {actions(row)}
                    </div>
                    <StatusBadge domain="leave" status={row.status} />
                </div>
            )}
        />
    );
}