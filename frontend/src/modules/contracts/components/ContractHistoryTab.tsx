import { History } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, EmptyState, Pagination, Skeleton } from "@/components/ui";
import { auditActionLabel } from "@/lib/auditLabels";
import i18n from "@/i18n";
import { tr } from "@/i18n/translate";
import { formatDateTime } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { getContractHistory } from "../services/contractService";

const FIELD_LABELS: Record<string, string> = {
    contract_type: "type de contrat",
    position: "poste",
    start_date: "date de début",
    end_date: "date de fin",
    probation_days: "période d'essai",
    base_salary: "rémunération",
    currency: "devise",
    reference: "référence",
};

const REASONS: Record<string, string> = {
    renewed: "clôturé par un renouvellement",
    employee_departure: "départ de l'employé",
    expired: "échéance atteinte",
};

/** Human description of an audit entry. Field NAMES only: amounts are never recorded. */
function describe(metadata: Record<string, unknown>): string {
    const parts: string[] = [];
    if (Array.isArray(metadata.fields)) {
        parts.push(i18n.t("Champs modifiés : {{fields}}", { fields: metadata.fields.map((field) => tr(FIELD_LABELS[String(field)] ?? String(field))).join(", ") }));
    }
    if (typeof metadata.reason === "string") parts.push(tr(REASONS[metadata.reason] ?? metadata.reason));
    if (typeof metadata.renews === "string") parts.push(i18n.t("Renouvelle le contrat {{reference}}", { reference: metadata.renews }));
    if (typeof metadata.renewed_by === "string") parts.push(i18n.t("Renouvelé par {{reference}}", { reference: metadata.renewed_by }));
    return parts.join(" · ");
}

export function ContractHistoryTab({ contractId }: { contractId: number }) {
    useTranslation();
    const [page, setPage] = useState(1);
    const query = useApiQuery(["contract-history", contractId, page], (signal) =>
        getContractHistory(contractId, page, signal),
    );

    return (
        <div className="space-y-4">
            {query.error && <Alert tone="error">{query.error.message}</Alert>}
            {!query.data && query.loading && <Skeleton className="h-32" />}
            {query.data && query.data.results.length === 0 && <EmptyState icon={History} title="Aucun événement" />}
            {query.data && query.data.results.length > 0 && (
                <ul className="divide-y-2 divide-ink border-2 border-ink bg-paper">
                    {query.data.results.map((entry) => {
                        const detail = describe(entry.metadata);
                        return (
                            <li key={entry.id} className="p-3">
                                <p className="font-bold">{auditActionLabel(entry.action)}</p>
                                {detail && <p className="text-sm">{detail}</p>}
                                <p className="text-sm text-gray-dark">
                                    {entry.actor_email || tr("Système")} · <time dateTime={entry.created_at}>{formatDateTime(entry.created_at)}</time>
                                </p>
                            </li>
                        );
                    })}
                </ul>
            )}
            <Pagination page={page} count={query.data?.count ?? 0} onPageChange={setPage} />
        </div>
    );
}
