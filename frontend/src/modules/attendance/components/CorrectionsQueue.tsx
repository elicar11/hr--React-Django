import { Check, ClipboardCheck, X } from "lucide-react";
import { useState } from "react";
import { Alert, Button, ConfirmDialog, FilterBar, Pagination, Select } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import type { useListParams } from "@/lib/hooks/useListParams";
import { notify } from "@/lib/notify";
import { EmptyState } from "@/components/ui";
import { approveCorrection, listCorrections, rejectCorrection } from "../services/attendanceService";
import type { AttendanceCorrection } from "../types";
import { CorrectionsTable } from "./CorrectionsTable";

type ListParams = ReturnType<typeof useListParams>;

export function CorrectionsQueue({ list }: { list: ListParams }) {
    const status = list.filters.correction_status || "PENDING";
    const params = {
        page: list.page,
        status: status === "ALL" ? undefined : status,
        employee: list.filters.employee || undefined,
        ordering: "-created_at",
    };
    const [version, setVersion] = useState(0);
    const query = useApiQuery(["attendance-corrections", params, version], (signal) => listCorrections(params, signal));
    const [deciding, setDeciding] = useState<{ correction: AttendanceCorrection; kind: "approve" | "reject" } | null>(null);
    const refresh = () => setVersion((current) => current + 1);

    const target = deciding?.correction;
    const summary = target ? (
        <>
            Demande de <strong>{target.employee_name}</strong> pour le <strong>{formatDate(target.date)}</strong>.
        </>
    ) : null;

    return (
        <>
            <FilterBar>
                <Select label="Statut" className="min-w-48" value={status} onChange={(e) => list.setFilter("correction_status", e.target.value)}>
                    <option value="PENDING">En attente</option>
                    <option value="APPROVED">Approuvées</option>
                    <option value="REJECTED">Refusées</option>
                    <option value="CANCELLED">Annulées</option>
                    <option value="ALL">Toutes</option>
                </Select>
            </FilterBar>

            {query.error && (
                <Alert tone="error" title="Impossible de charger les demandes" className="mb-4">
                    <p>{query.error.message}</p>
                </Alert>
            )}

            <div aria-busy={query.loading || undefined} className={query.loading && query.data ? "opacity-60" : undefined}>
                <CorrectionsTable
                    rows={query.data?.results ?? []}
                    loading={query.loading && !query.data}
                    showEmployee
                    renderActions={(correction) =>
                        correction.status === "PENDING" ? (
                            <div className="flex flex-wrap gap-2">
                                <Button size="sm" onClick={() => setDeciding({ correction, kind: "approve" })} leftIcon={<Check className="size-4" aria-hidden="true" />}>
                                    Approuver
                                </Button>
                                <Button size="sm" variant="danger" onClick={() => setDeciding({ correction, kind: "reject" })} leftIcon={<X className="size-4" aria-hidden="true" />}>
                                    Refuser
                                </Button>
                            </div>
                        ) : null
                    }
                    emptyState={
                        <EmptyState
                            icon={ClipboardCheck}
                            title={status === "PENDING" ? "Aucune demande en attente" : "Aucune demande"}
                            description="Les demandes de correction des employés apparaissent ici."
                        />
                    }
                />
            </div>
            <Pagination page={list.page} count={query.data?.count ?? 0} onPageChange={list.setPage} />

            <ConfirmDialog
                open={deciding?.kind === "approve"}
                onClose={() => setDeciding(null)}
                title="Approuver la correction ?"
                message={
                    <>
                        {summary} L'enregistrement du jour sera créé ou remplacé, et les retards et heures supplémentaires recalculés.
                    </>
                }
                reason={{ label: "Commentaire (facultatif)", maxLength: 500 }}
                confirmLabel="Approuver"
                onConfirm={async (comment) => {
                    if (!target) return;
                    await approveCorrection(target.id, comment);
                    notify.success("Correction approuvée");
                    refresh();
                }}
            />
            <ConfirmDialog
                open={deciding?.kind === "reject"}
                onClose={() => setDeciding(null)}
                tone="danger"
                title="Refuser la correction ?"
                message={<>{summary} Le motif du refus sera communiqué à l'employé.</>}
                reason={{ label: "Motif du refus", required: true, maxLength: 500 }}
                confirmLabel="Refuser"
                onConfirm={async (comment) => {
                    if (!target) return;
                    await rejectCorrection(target.id, comment);
                    notify.success("Correction refusée");
                    refresh();
                }}
            />
        </>
    );
}