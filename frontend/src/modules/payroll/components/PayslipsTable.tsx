import type { ColumnDef, OnChangeFn, SortingState } from "@tanstack/react-table";
import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Badge, DataTable, StatusBadge } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import type { PayslipListItem } from "../types";

function Reference({ payslip, to }: { payslip: PayslipListItem; to: string }) {
    return (
        <span className="flex flex-wrap items-center gap-2">
            <Link to={to} className="font-bold underline underline-offset-4 hover:bg-ink hover:text-paper">
                {payslip.reference}
            </Link>
            {payslip.revision > 1 && <Badge tone="outline">Révision {payslip.revision}</Badge>}
            {payslip.is_demo && (
                <Badge tone="alert" icon={TriangleAlert}>
                    Démo
                </Badge>
            )}
        </span>
    );
}

export function PayslipsTable({
    caption,
    rows,
    loading,
    showEmployee,
    showPeriod,
    detailPath,
    sorting,
    onSortingChange,
    emptyState,
}: {
    caption: string;
    rows: PayslipListItem[];
    loading: boolean;
    showEmployee: boolean;
    showPeriod: boolean;
    detailPath: (payslip: PayslipListItem) => string;
    sorting?: SortingState;
    onSortingChange?: OnChangeFn<SortingState>;
    emptyState: ReactNode;
}) {
    const columns: ColumnDef<PayslipListItem>[] = [
        {
            id: "reference",
            header: "Bulletin",
            enableSorting: false,
            cell: ({ row }) => <Reference payslip={row.original} to={detailPath(row.original)} />,
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
            ] satisfies ColumnDef<PayslipListItem>[])
            : []),
        ...(showPeriod
            ? ([
                {
                    id: "period_code",
                    header: "Période",
                    enableSorting: false,
                    cell: ({ row }) =>
                        showEmployee ? (
                            <Link to={`/payroll/periods/${row.original.period}`} className="underline underline-offset-4 hover:bg-ink hover:text-paper">
                                {row.original.period_code}
                            </Link>
                        ) : (
                            row.original.period_code
                        ),
                },
            ] satisfies ColumnDef<PayslipListItem>[])
            : []),
        {
            id: "status",
            header: "Statut",
            enableSorting: false,
            cell: ({ row }) => <StatusBadge domain="payslip" status={row.original.status} />,
        },
        {
            accessorKey: "gross_pay",
            header: "Brut",
            cell: ({ row }) => formatMoney(row.original.gross_pay, row.original.currency),
        },
        {
            id: "total_deductions",
            header: "Retenues",
            enableSorting: false,
            cell: ({ row }) => formatMoney(row.original.total_deductions, row.original.currency),
        },
        {
            accessorKey: "net_pay",
            header: "Net à payer",
            cell: ({ row }) => <strong>{formatMoney(row.original.net_pay, row.original.currency)}</strong>,
        },
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
                    <Reference payslip={row} to={detailPath(row)} />
                    {showEmployee && <p className="text-sm text-gray-dark">{row.employee_name}</p>}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <StatusBadge domain="payslip" status={row.status} />
                        <strong className="font-display text-xl">{formatMoney(row.net_pay, row.currency)}</strong>
                    </div>
                </div>
            )}
        />
    );
}