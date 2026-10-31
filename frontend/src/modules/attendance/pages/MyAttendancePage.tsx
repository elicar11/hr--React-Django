import { ClipboardList, Plus } from "lucide-react";
import { useState } from "react";
import { Alert, Button, Card, ConfirmDialog, DateField, EmptyState, Pagination } from "@/components/ui";
import { firstOfMonthISO, formatDate, todayISO } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useListParams } from "@/lib/hooks/useListParams";
import { notify } from "@/lib/notify";
import { ClockCard } from "../components/ClockCard";
import { CorrectionRequestModal } from "../components/CorrectionRequestModal";
import { CorrectionsTable } from "../components/CorrectionsTable";
import { RecordsTable } from "../components/RecordsTable";
import { cancelCorrection, listAttendance, listCorrections } from "../services/attendanceService";
import type { AttendanceCorrection } from "../types";
import { PageHeader } from "@/components/ui";

/** Employee space: clock, own records of the month, own correction requests. */
export function MyAttendancePage() {
    const list = useListParams(["date_from", "date_to"]);
    const dateFrom = list.filters.date_from || firstOfMonthISO();
    const dateTo = list.filters.date_to || todayISO();
    const [version, setVersion] = useState(0);
    const refresh = () => setVersion((current) => current + 1);

    const recordParams = { page: list.page, ordering: "-date", date_from: dateFrom, date_to: dateTo };
    const records = useApiQuery(["my-attendance", recordParams, version], (signal) => listAttendance(recordParams, signal));

    const [correctionPage, setCorrectionPage] = useState(1);
    const correctionParams = { page: correctionPage, ordering: "-created_at" };
    const corrections = useApiQuery(["my-corrections", correctionParams, version], (signal) => listCorrections(correctionParams, signal));

    const [requesting, setRequesting] = useState(false);
    const [cancelling, setCancelling] = useState<AttendanceCorrection | null>(null);

    return (
        <>
            <PageHeader
                title="Mes présences"
                description="Pointez, consultez vos pointages et demandez une correction en cas d'oubli."
            />

            <div className="space-y-6">
                <div className="max-w-xl">
                    <ClockCard onChanged={refresh} />
                </div>

                <Card title="Mes pointages" description="Par défaut : le mois en cours">
                    <div className="mb-4 flex flex-wrap items-end gap-3">
                        <DateField label="Du" value={dateFrom} max={dateTo} onChange={(e) => list.setFilter("date_from", e.target.value)} />
                        <DateField label="Au" value={dateTo} min={dateFrom} onChange={(e) => list.setFilter("date_to", e.target.value)} />
                    </div>
                    {records.error && <Alert tone="error" className="mb-4">{records.error.message}</Alert>}
                    <RecordsTable
                        caption="Mes pointages"
                        rows={records.data?.results ?? []}
                        loading={records.loading && !records.data}
                        showEmployee={false}
                        emptyState={<EmptyState icon={ClipboardList} title="Aucun pointage" description="Aucun enregistrement sur cette période." />}
                    />
                    <Pagination page={list.page} count={records.data?.count ?? 0} onPageChange={list.setPage} />
                </Card>

                <Card
                    title="Mes demandes de correction"
                    actions={
                        <Button size="sm" onClick={() => setRequesting(true)} leftIcon={<Plus className="size-4" aria-hidden="true" />}>
                            Demander une correction
                        </Button>
                    }
                >
                    {corrections.error && <Alert tone="error" className="mb-4">{corrections.error.message}</Alert>}
                    <CorrectionsTable
                        rows={corrections.data?.results ?? []}
                        loading={corrections.loading && !corrections.data}
                        showEmployee={false}
                        renderActions={(correction) =>
                            correction.status === "PENDING" ? (
                                <Button size="sm" variant="secondary" onClick={() => setCancelling(correction)}>
                                    Annuler
                                </Button>
                            ) : null
                        }
                        emptyState={
                            <EmptyState
                                icon={ClipboardList}
                                title="Aucune demande"
                                description="Vous avez oublié de pointer ? Demandez une correction."
                            />
                        }
                    />
                    <Pagination page={correctionPage} count={corrections.data?.count ?? 0} onPageChange={setCorrectionPage} />
                </Card>
            </div>

            <CorrectionRequestModal open={requesting} onClose={() => setRequesting(false)} onSaved={refresh} />
            <ConfirmDialog
                open={cancelling !== null}
                onClose={() => setCancelling(null)}
                title="Annuler cette demande ?"
                message={
                    <>
                        Votre demande pour le <strong>{cancelling ? formatDate(cancelling.date) : ""}</strong> sera retirée.
                    </>
                }
                confirmLabel="Annuler la demande"
                cancelLabel="Conserver"
                onConfirm={async () => {
                    if (!cancelling) return;
                    await cancelCorrection(cancelling.id);
                    notify.success("Demande annulée");
                    refresh();
                }}
            />
        </>
    );
}