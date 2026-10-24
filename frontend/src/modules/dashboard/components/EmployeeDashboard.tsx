import { Banknote, CalendarDays, Clock, FileText, LogIn, LogOut, TriangleAlert, UserX } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import {
    Alert,
    Badge,
    Button,
    Card,
    EmptyState,
    PageHeader,
    Skeleton,
    StatusBadge,
    buttonStyles,
} from "@/components/ui";
import { formatDate, formatDecimal, formatLongDate, formatMinutes, formatMoney, formatTime } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { notify } from "@/lib/notify";
import { checkIn, checkOut } from "@/modules/attendance/services/attendanceService";
import type { LeaveBalance } from "@/modules/leaves/types";
import { getEmployeeDashboard } from "../services/dashboardService";
import type { EmployeeDashboard as EmployeeDashboardData } from "../types";

function Meter({ balance }: { balance: LeaveBalance }) {
    // Display only: the figures themselves are computed and validated by the API.
    const allocated = Number(balance.allocated);
    const percent = allocated > 0 ? Math.min(100, (Number(balance.used) / allocated) * 100) : 0;
    return (
        <div
            role="progressbar"
            aria-label={`${balance.leave_type_name} : ${formatDecimal(balance.used)} jours utilisés sur ${formatDecimal(balance.allocated)}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(percent)}
            className="h-3 border-2 border-ink bg-paper"
        >
            <div className="h-full bg-ink" style={{ width: `${percent}%` }} />
        </div>
    );
}

function TodayCard({ today, onChanged }: { today: EmployeeDashboardData["today"]; onChanged: () => void }) {
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
                            {record.check_out && <Badge tone="outline" icon={Clock}>Travaillé : {formatMinutes(record.worked_minutes)}</Badge>}
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

export function EmployeeDashboard() {
    const query = useApiQuery(["employee-dashboard"], (signal) => getEmployeeDashboard(signal));
    const data = query.data;

    if (query.error?.status === 404) {
        return (
            <>
                <PageHeader title="Mon tableau de bord" />
                <EmptyState
                    icon={UserX}
                    title="Aucun dossier employé"
                    description="Aucun dossier employé n'est associé à votre compte. Contactez les ressources humaines."
                />
            </>
        );
    }

    return (
        <>
            <PageHeader
                title="Mon tableau de bord"
                description={
                    data
                        ? `${data.employee.first_name} ${data.employee.last_name} · ${data.employee.matricule} · ${data.employee.department_name}, ${data.employee.position_title}`
                        : undefined
                }
            />

            {query.error && (
                <Alert tone="error" title="Impossible de charger vos données" className="mb-6">
                    <p>{query.error.message}</p>
                    <Button size="sm" variant="secondary" className="mt-2" onClick={query.reload}>
                        Réessayer
                    </Button>
                </Alert>
            )}

            {!data && query.loading && (
                <div className="grid gap-6 lg:grid-cols-2">
                    <Skeleton className="h-56" />
                    <Skeleton className="h-56" />
                </div>
            )}

            {data && (
                <div className="grid gap-6 lg:grid-cols-2">
                    <TodayCard today={data.today} onChanged={query.reload} />

                    <Card
                        title="Mes soldes de congés"
                        description={`Année ${new Date().getFullYear()}`}
                        actions={
                            <Link to="/my/leaves" className={buttonStyles({ variant: "secondary", size: "sm" })}>
                                Mes congés
                            </Link>
                        }
                    >
                        {data.leave_balances.length === 0 ? (
                            <EmptyState icon={CalendarDays} title="Aucun solde" description="Aucun solde n'a encore été défini pour cette année." />
                        ) : (
                            <ul className="space-y-4">
                                {data.leave_balances.map((balance) => (
                                    <li key={balance.id} className="space-y-1.5">
                                        <div className="flex items-baseline justify-between gap-3">
                                            <span className="font-bold">{balance.leave_type_name}</span>
                                            <span className="text-sm">
                                                <strong className="font-display text-2xl">{formatDecimal(balance.remaining)}</strong> / {formatDecimal(balance.allocated)} j restants
                                            </span>
                                        </div>
                                        <Meter balance={balance} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>

                    <Card title="Mes demandes de congé" description={`${data.pending_leave_requests} en attente`}>
                        {data.next_leave && (
                            <div className="mb-4 border-2 border-ink bg-gray-light p-3">
                                <p className="text-xs font-bold uppercase tracking-widest">Prochain congé</p>
                                <p className="font-bold">
                                    {formatDate(data.next_leave.start_date)} → {formatDate(data.next_leave.end_date)} · {formatDecimal(data.next_leave.days)} j
                                </p>
                                <p className="text-sm text-gray-dark">{data.next_leave.leave_type_name}</p>
                            </div>
                        )}
                        {data.recent_leave_requests.length === 0 ? (
                            <EmptyState icon={CalendarDays} title="Aucune demande" />
                        ) : (
                            <ul className="divide-y-2 divide-ink border-2 border-ink">
                                {data.recent_leave_requests.map((leave) => (
                                    <li key={leave.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                                        <div>
                                            <p className="font-bold">{leave.leave_type_name}</p>
                                            <p className="text-sm text-gray-dark">
                                                {formatDate(leave.start_date)} → {formatDate(leave.end_date)} · {formatDecimal(leave.days)} j
                                            </p>
                                        </div>
                                        <StatusBadge domain="leave" status={leave.status} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>

                    <Card
                        title="Mon dernier bulletin"
                        actions={
                            <Link to="/my/payslips" className={buttonStyles({ variant: "secondary", size: "sm" })}>
                                Mes bulletins
                            </Link>
                        }
                    >
                        {data.latest_payslip ? (
                            <div className="space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-bold">Période {data.latest_payslip.period_code}</span>
                                    <StatusBadge domain="payslip" status={data.latest_payslip.status} />
                                    {data.latest_payslip.is_demo && (
                                        <Badge tone="alert" icon={TriangleAlert}>
                                            Démo
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-xs font-bold uppercase tracking-widest text-gray-dark">Net à payer</p>
                                <p className="font-display text-4xl font-bold">
                                    {formatMoney(data.latest_payslip.net_pay, data.latest_payslip.currency)}
                                </p>
                            </div>
                        ) : (
                            <EmptyState icon={Banknote} title="Aucun bulletin" description="Vos bulletins validés apparaîtront ici." />
                        )}
                    </Card>

                    <Card title="Mes corrections de pointage" className="lg:col-span-2">
                        {data.recent_corrections.length === 0 ? (
                            <EmptyState icon={FileText} title="Aucune demande de correction" />
                        ) : (
                            <ul className="divide-y-2 divide-ink border-2 border-ink">
                                {data.recent_corrections.map((correction) => (
                                    <li key={correction.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                                        <div>
                                            <p className="font-bold">{formatDate(correction.date)}</p>
                                            <p className="text-sm text-gray-dark">{correction.reason}</p>
                                        </div>
                                        <StatusBadge domain="correction" status={correction.status} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                </div>
            )}
        </>
    );
}