import { Clock, LogIn, LogOut, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Card, StatusBadge } from "@/components/ui";
import { formatLongDate, formatMinutes, formatTime } from "@/lib/format";
import { notify } from "@/lib/notify";
import { checkIn, checkOut } from "../services/attendanceService";
import type { TodayOverview } from "../types";

/** Today's schedule and clock buttons, from data already loaded. The time of each punch is the server's. */
export function ClockPanel({ today, onChanged }: { today: TodayOverview; onChanged: () => void }) {
    const [busy, setBusy] = useState(false);
    const { record, schedule } = today;
    const awaitingCheckOut = record?.status === "PRESENT" && record.check_in && !record.check_out;

    async function clock(kind: "in" | "out") {
        setBusy(true);
        try {
            const result = kind === "in" ? await checkIn() : await checkOut();
            const time = formatTime(kind === "in" ? result.check_in : result.check_out);
            notify.success(kind === "in" ? "Entrée enregistrée" : "Sortie enregistrée", `À ${time}`);
            onChanged();
        } catch (error) {
            notify.error(error);
        } finally {
            setBusy(false);
        }
    }

    return (
        <Card title="Aujourd'hui" description={formatLongDate(today.date)}>
            <div className="space-y-4">
                <p className="text-sm text-gray-dark">
                    {today.is_working_day && schedule
                        ? `Horaire : ${schedule.start_time.slice(0, 5)} – ${schedule.end_time.slice(0, 5)}`
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
        </Card>
    );
}