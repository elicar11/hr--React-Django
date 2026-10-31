import { Clock, LogIn, LogOut, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Alert, Badge, Button, Card, Skeleton, StatusBadge } from "@/components/ui";
import { formatLongDate, formatMinutes, formatTime } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { notify } from "@/lib/notify";
import { checkIn, checkOut, getToday } from "../services/attendanceService";

/** Today's schedule and clock buttons. The time of each punch is the server's. */
export function ClockCard({ onChanged }: { onChanged?: () => void }) {
    const query = useApiQuery(["attendance-today"], (signal) => getToday(signal));
    const [busy, setBusy] = useState(false);
    const today = query.data;
    const record = today?.record ?? null;
    const awaitingCheckOut = record?.status === "PRESENT" && record.check_in && !record.check_out;

    async function clock(kind: "in" | "out") {
        setBusy(true);
        try {
            const result = kind === "in" ? await checkIn() : await checkOut();
            notify.success(
                kind === "in" ? "Entrée enregistrée" : "Sortie enregistrée",
                `À ${formatTime(kind === "in" ? result.check_in : result.check_out)}`,
            );
            query.reload();
            onChanged?.();
        } catch (error) {
            notify.error(error);
        } finally {
            setBusy(false);
        }
    }

    if (query.error?.status === 404) {
        return (
            <Alert tone="warning" title="Pointage indisponible">
                Aucun dossier employé n'est associé à votre compte : contactez les ressources humaines.
            </Alert>
        );
    }

    return (
        <Card title="Aujourd'hui" description={today ? formatLongDate(today.date) : undefined}>
            {query.error && <Alert tone="error">{query.error.message}</Alert>}
            {!today && query.loading && <Skeleton className="h-24" />}
            {today && (
                <div className="space-y-4">
                    <p className="text-sm text-gray-dark">
                        {today.is_working_day && today.schedule
                            ? `Horaire : ${today.schedule.start_time.slice(0, 5)} – ${today.schedule.end_time.slice(0, 5)}`
                            : "Jour non travaillé"}
                    </p>

                    {!record && (
                        <>
                            <p className="font-bold">Vous n'avez pas encore pointé.</p>
                            <Button loading={busy} onClick={() => void clock("in")} leftIcon={<LogIn className="size-4" aria-hidden="true" />}>
                                Pointer mon entrée
                            </Button>
                        </>
                    )}

                    {record && record.status !== "PRESENT" && (
                        <div className="space-y-2">
                            <StatusBadge domain="attendance" status={record.status} />
                            {record.absence_reason && <p className="text-sm">{record.absence_reason}</p>}
                        </div>
                    )}

                    {record?.status === "PRESENT" && (
                        <div className="space-y-3">
                            <p>
                                Entrée à <strong>{formatTime(record.check_in)}</strong>
                                {record.check_out && (
                                    <>
                                        , sortie à <strong>{formatTime(record.check_out)}</strong>
                                    </>
                                )}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {record.late_minutes > 0 && (
                                    <Badge tone="alert" icon={TriangleAlert}>
                                        Retard : {formatMinutes(record.late_minutes)}
                                    </Badge>
                                )}
                                {record.check_out && (
                                    <Badge tone="outline" icon={Clock}>
                                        Travaillé : {formatMinutes(record.worked_minutes)}
                                    </Badge>
                                )}
                                {record.overtime_minutes > 0 && <Badge tone="solid">Heures sup : {formatMinutes(record.overtime_minutes)}</Badge>}
                            </div>
                            {awaitingCheckOut && (
                                <Button loading={busy} onClick={() => void clock("out")} leftIcon={<LogOut className="size-4" aria-hidden="true" />}>
                                    Pointer ma sortie
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
}