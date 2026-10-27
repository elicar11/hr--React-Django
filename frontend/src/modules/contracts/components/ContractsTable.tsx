import type { ColumnDef, OnChangeFn, SortingState } from "@tanstack/react-table";
import { Eye, Pencil, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Badge, DataTable, RowActions, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { ContractListItem } from "../types";

/** Remaining time before the end of a running contract (display only). */
function Deadline({ days }: { days: number | null }) {
    if (days === null) return <span className="text-gray-dark">—</span>;
    if (days < 0) {
        return (
            <Badge tone="alert" icon={TriangleAlert}>
                Dépassé de {Math.abs(days)} j
            </Badge>
        );
    }
    if (days === 0) return <Badge tone="alert">Aujourd'hui</Badge>;
    return <Badge tone={days <= 30 ? "solid" : "outline"}>J-{days}</Badge>;
}

function ContractActions({ contract }: { contract: ContractListItem }) {
    return (
        <RowActions
            label={`Actions pour le contrat ${contract.reference}`}
            items={[
                { label: "Voir le contrat", icon: Eye, to: `/contracts/${contract.id}` },
                ...(contract.status === "DRAFT"
                    ? [{ label: "Modifier", icon: Pencil, to: `/contracts/${contract.id}/edit` }]
                    : []),
            ]}
        />
    );
}

const columns: ColumnDef<ContractListItem>[] = [
    {
        accessorKey: "reference",
        header: "Référence",
        cell: ({ row }) => (
            <Link to={`/contracts/${row.original.id}`} className="font-bold underline underline-offset-4 hover:bg-ink hover:text-paper">
                {row.original.reference}
            </Link>
        ),
    },
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
    { id: "contract_type_name", header: "Type", enableSorting: false, cell: ({ row }) => row.original.contract_type_name },
    { id: "position_title", header: "Poste", enableSorting: false, cell: ({ row }) => row.original.position_title },
    { accessorKey: "start_date", header: "Début", cell: ({ row }) => formatDate(row.original.start_date) },
    {
        accessorKey: "end_date",
        header: "Fin",
        cell: ({ row }) => (row.original.end_date ? formatDate(row.original.end_date) : "Indéterminée"),
    },
    {
        id: "days_remaining",
        header: "Échéance",
        enableSorting: false,
        cell: ({ row }) => <Deadline days={row.original.days_remaining} />,
    },
    {
        id: "status",
        header: "Statut",
        enableSorting: false,
        cell: ({ row }) => <StatusBadge domain="contract" status={row.original.status} />,
    },
    {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => <ContractActions contract={row.original} />,
    },
];

export function ContractsTable({
    caption,
    rows,
    loading,
    sorting,
    onSortingChange,
    emptyState,
}: {
    caption: string;
    rows: ContractListItem[];
    loading: boolean;
    sorting?: SortingState;
    onSortingChange?: OnChangeFn<SortingState>;
    emptyState: ReactNode;
}) {
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
                            <Link to={`/contracts/${row.id}`} className="font-bold underline underline-offset-4">
                                {row.reference}
                            </Link>
                            <p className="text-sm text-gray-dark">{row.employee_name}</p>
                            <p className="text-sm text-gray-dark">
                                {row.contract_type_name} · {row.position_title}
                            </p>
                        </div>
                        <ContractActions contract={row} />
                    </div>
                    <p className="text-sm">
                        {formatDate(row.start_date)} → {row.end_date ? formatDate(row.end_date) : "indéterminée"}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge domain="contract" status={row.status} />
                        <Deadline days={row.days_remaining} />
                    </div>
                </div>
            )}
        />
    );
}