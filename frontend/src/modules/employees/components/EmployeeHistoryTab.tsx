import { History } from "lucide-react";
import { useState } from "react";
import { Alert, EmptyState, Pagination, Skeleton } from "@/components/ui";
import { auditActionLabel } from "@/lib/auditLabels";
import { formatDate, formatDateTime } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { getEmployeeHistory } from "../services/employeeService";

const FIELD_LABELS: Record<string, string> = {
    matricule: "matricule",
    last_name: "nom",
    first_name: "prénom",
    date_of_birth: "date de naissance",
    work_email: "e-mail professionnel",
    personal_email: "e-mail personnel",
    work_phone: "téléphone professionnel",
    personal_phone: "téléphone personnel",
    address_line: "adresse",
    postal_code: "code postal",
    city: "ville",
    hire_date: "date d'embauche",
    user: "compte utilisateur",
};

/** Human description of an audit entry. Only field NAMES are recorded, never their values. */
function describe(action: string, metadata: Record<string, unknown>): string {
    if (Array.isArray(metadata.fields)) {
        const names = metadata.fields.map((field) => FIELD_LABELS[String(field)] ?? String(field));
        return `Champs modifiés : ${names.join(", ")}`;
    }
    if (action === "employee.assigned") {
        const from = metadata.from as { department?: string; position?: string } | undefined;
        const to = metadata.to as { department?: string; position?: string } | undefined;
        const start = typeof metadata.start_date === "string" ? ` à partir du ${formatDate(metadata.start_date)}` : "";
        return `${from?.department ?? "?"} / ${from?.position ?? "?"} → ${to?.department ?? "?"} / ${to?.position ?? "?"}${start}`;
    }
    if (action === "employee.terminated" && typeof metadata.departure_date === "string") {
        return `Départ le ${formatDate(metadata.departure_date)}`;
    }
    return "";
}

export function EmployeeHistoryTab({ employeeId }: { employeeId: number }) {
    const [page, setPage] = useState(1);
    const query = useApiQuery(["employee-history", employeeId, page], (signal) =>
        getEmployeeHistory(employeeId, page, signal),
    );

    return (
        <div className="space-y-4">
            {query.error && <Alert tone="error">{query.error.message}</Alert>}
            {!query.data && query.loading && <Skeleton className="h-32" />}
            {query.data && query.data.results.length === 0 && (
                <EmptyState icon={History} title="Aucune modification enregistrée" />
            )}
            {query.data && query.data.results.length > 0 && (
                <ul className="divide-y-2 divide-ink border-2 border-ink bg-paper">
                    {query.data.results.map((entry) => {
                        const detail = describe(entry.action, entry.metadata);
                        return (
                            <li key={entry.id} className="p-3">
                                <p className="font-bold">{auditActionLabel(entry.action)}</p>
                                {detail && <p className="text-sm">{detail}</p>}
                                <p className="text-sm text-gray-dark">
                                    {entry.actor_email || "Système"} · <time dateTime={entry.created_at}>{formatDateTime(entry.created_at)}</time>
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