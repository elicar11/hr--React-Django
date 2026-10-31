import type { ColumnDef } from "@tanstack/react-table";
import { FileText } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Alert, Badge, DataTable, EmptyState, PageHeader, Pagination, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { listContracts } from "../services/contractService";
import type { ContractListItem } from "../types";

function Remaining({ contract }: { contract: ContractListItem }) {
    if (contract.status !== "ACTIVE") return <span className="text-gray-dark">—</span>;
    if (contract.days_remaining === null) return <Badge tone="muted">Durée indéterminée</Badge>;
    if (contract.days_remaining < 0) return <Badge tone="alert">Échu</Badge>;
    return (
        <Badge tone={contract.days_remaining <= 30 ? "alert" : "outline"}>
            {contract.days_remaining} jour{contract.days_remaining > 1 ? "s" : ""} restant{contract.days_remaining > 1 ? "s" : ""}
        </Badge>
    );
}

/** Employee space: the user's own signed contracts (the API hides drafts and other people's contracts). */
export function MyContractsPage() {
    const [page, setPage] = useState(1);
    const params = { page, ordering: "-start_date" };
    const query = useApiQuery(["my-contracts", params], (signal) => listContracts(params, signal));

    const columns: ColumnDef<ContractListItem>[] = [
        {
            id: "reference",
            header: "Référence",
            enableSorting: false,
            cell: ({ row }) => (
                <Link to={`/my/contracts/${row.original.id}`} className="font-bold underline underline-offset-4 hover:bg-ink hover:text-paper">
                    {row.original.reference}
                </Link>
            ),
        },
        { id: "type", header: "Type", enableSorting: false, cell: ({ row }) => row.original.contract_type_name },
        { id: "position", header: "Poste", enableSorting: false, cell: ({ row }) => row.original.position_title },
        {
            id: "period",
            header: "Période",
            enableSorting: false,
            cell: ({ row }) =>
                `${formatDate(row.original.start_date)} → ${row.original.end_date ? formatDate(row.original.end_date) : "indéterminée"}`,
        },
        { id: "status", header: "Statut", enableSorting: false, cell: ({ row }) => <StatusBadge domain="contract" status={row.original.status} /> },
        { id: "remaining", header: "Échéance", enableSorting: false, cell: ({ row }) => <Remaining contract={row.original} /> },
    ];

    return (
        <>
            <PageHeader title="Mes contrats" description="Vos contrats signés avec l'entreprise." />
            {query.error && <Alert tone="error" className="mb-4">{query.error.message}</Alert>}
            <div aria-busy={query.loading || undefined} className={query.loading && query.data ? "opacity-60" : undefined}>
                <DataTable
                    caption="Mes contrats"
                    columns={columns}
                    data={query.data?.results ?? []}
                    loading={query.loading && !query.data}
                    getRowId={(row) => String(row.id)}
                    emptyState={
                        <EmptyState
                            icon={FileText}
                            title="Aucun contrat"
                            description="Vos contrats signés apparaîtront ici. Un contrat encore en préparation n'est pas visible."
                        />
                    }
                    renderMobileCard={(row) => (
                        <div className="space-y-2">
                            <Link to={`/my/contracts/${row.id}`} className="font-bold underline underline-offset-4">
                                {row.reference}
                            </Link>
                            <p className="text-sm text-gray-dark">
                                {row.contract_type_name} · {row.position_title}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                                <StatusBadge domain="contract" status={row.status} />
                                <Remaining contract={row} />
                            </div>
                        </div>
                    )}
                />
            </div>
            <Pagination page={page} count={query.data?.count ?? 0} onPageChange={setPage} />
        </>
    );
}