import { Banknote, Calculator, CircleCheck, Download, FileX, Lock, LockOpen, Pencil, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
    Alert,
    Button,
    ConfirmDialog,
    EmptyState,
    FilterBar,
    PageHeader,
    Pagination,
    Select,
    Skeleton,
    StatCard,
    StatusBadge,
    buttonStyles,
} from "@/components/ui";
import { saveFile } from "@/lib/download";
import { formatDate, formatMoney } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { notify } from "@/lib/notify";
import { useSession } from "@/modules/auth/sessionContext";
import { BulkResult } from "../components/BulkResult";
import { PayrollBanner } from "../components/PayrollBanner";
import { PayslipsTable } from "../components/PayslipsTable";
import { PeriodFormModal } from "../components/PeriodFormModal";
import { usePayrollSettings } from "../hooks";
import {
    calculatePeriod,
    closePeriod,
    deletePeriod,
    exportPeriod,
    generatePayslips,
    getPeriod,
    listPayslips,
    reopenPeriod,
    validatePeriod,
} from "../services/payrollService";
import type { BulkError } from "../types";

type Dialog = "validate" | "close" | "reopen" | "delete" | null;
interface Outcome {
    kind: "generate" | "calculate" | "validate";
    count: number;
    errors: BulkError[];
    extra?: string;
}

export function PeriodDetailPage() {
    const { id } = useParams();
    const periodId = Number(id);
    const navigate = useNavigate();
    const { user } = useSession();
    const [version, setVersion] = useState(0);
    const refresh = () => setVersion((current) => current + 1);
    const [dialog, setDialog] = useState<Dialog>(null);
    const [editing, setEditing] = useState(false);
    const [busy, setBusy] = useState<"generate" | "calculate" | "export" | null>(null);
    const [outcome, setOutcome] = useState<Outcome | null>(null);
    const [status, setStatus] = useState("");
    const [page, setPage] = useState(1);

    const settings = usePayrollSettings();
    const currency = settings.data?.currency ?? "";
    const query = useApiQuery(["payroll-period", periodId, version], (signal) => getPeriod(periodId, signal));
    const payslipParams = { period: periodId, page, status: status || undefined };
    const payslips = useApiQuery(["period-payslips", payslipParams, version], (signal) => listPayslips(payslipParams, signal));
    const period = query.data;

    if (query.error && !period) {
        return (
            <>
                <PageHeader title="Période de paie" />
                <EmptyState
                    icon={FileX}
                    title={query.error.status === 404 ? "Période introuvable" : "Chargement impossible"}
                    description={query.error.message}
                    action={<Link to="/payroll" className={buttonStyles()}>Retour à la paie</Link>}
                />
            </>
        );
    }
    if (!period) return <Skeleton className="h-96" />;

    const open = period.status === "OPEN";

    async function run<T>(kind: "generate" | "calculate", action: () => Promise<T>, toOutcome: (result: T) => Outcome) {
        setBusy(kind);
        setOutcome(null);
        try {
            setOutcome(toOutcome(await action()));
            refresh();
        } catch (error) {
            notify.error(error);
        } finally {
            setBusy(null);
        }
    }

    async function handleExport() {
        setBusy("export");
        try {
            saveFile(await exportPeriod(periodId));
            notify.success("Export téléchargé", "Les bulletins de démonstration y sont signalés.");
        } catch (error) {
            notify.error(error);
        } finally {
            setBusy(null);
        }
    }

    return (
        <>
            <PageHeader
                title={`Période ${period.code}`}
                description={`${period.name} · du ${formatDate(period.start_date)} au ${formatDate(period.end_date)}`}
                breadcrumb={[{ label: "Paie", to: "/payroll" }, { label: period.code }]}
                actions={
                    <>
                        <Button variant="secondary" onClick={() => void handleExport()} loading={busy === "export"} leftIcon={<Download className="size-4" aria-hidden="true" />}>
                            Exporter
                        </Button>
                        {open && (
                            <Button variant="secondary" onClick={() => setEditing(true)} leftIcon={<Pencil className="size-4" aria-hidden="true" />}>
                                Modifier
                            </Button>
                        )}
                    </>
                }
            />
            <PayrollBanner />

            <div className="mb-6 flex flex-wrap items-center gap-3">
                <StatusBadge domain="period" status={period.status} />
                {!open && <p className="text-sm text-gray-dark">Période clôturée : aucun bulletin ne peut plus être généré, calculé ni validé.</p>}
            </div>

            <section aria-label="Totaux" className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Bulletins" value={period.payslips_count ?? 0} hint="Hors annulés" icon={Banknote} />
                <StatCard label="Brut total" value={formatMoney(period.total_gross ?? "0", currency)} />
                <StatCard label="Retenues" value={formatMoney(period.total_deductions ?? "0", currency)} />
                <StatCard label="Net total" value={formatMoney(period.total_net ?? "0", currency)} />
            </section>

            {open ? (
                <div className="mb-6 flex flex-wrap gap-3 border-2 border-ink bg-gray-light p-4">
                    <Button
                        loading={busy === "generate"}
                        leftIcon={<UserPlus className="size-4" aria-hidden="true" />}
                        onClick={() =>
                            void run("generate", () => generatePayslips(periodId), (result) => ({
                                kind: "generate",
                                count: result.created,
                                errors: [],
                                extra: result.skipped_without_contract.length
                                    ? `Sans contrat applicable (ignorés) : ${result.skipped_without_contract.join(", ")}.`
                                    : undefined,
                            }))
                        }
                    >
                        Générer les bulletins
                    </Button>
                    <Button
                        variant="secondary"
                        loading={busy === "calculate"}
                        leftIcon={<Calculator className="size-4" aria-hidden="true" />}
                        onClick={() =>
                            void run("calculate", () => calculatePeriod(periodId), (result) => ({
                                kind: "calculate",
                                count: result.calculated,
                                errors: result.errors,
                            }))
                        }
                    >
                        Calculer tous les bulletins
                    </Button>
                    <Button variant="secondary" onClick={() => setDialog("validate")} leftIcon={<CircleCheck className="size-4" aria-hidden="true" />}>
                        Valider les bulletins calculés
                    </Button>
                    <Button variant="secondary" onClick={() => setDialog("close")} leftIcon={<Lock className="size-4" aria-hidden="true" />}>
                        Clôturer la période
                    </Button>
                    <Button variant="danger" onClick={() => setDialog("delete")} leftIcon={<Trash2 className="size-4" aria-hidden="true" />}>
                        Supprimer
                    </Button>
                </div>
            ) : (
                user.role === "ADMIN" && (
                    <div className="mb-6">
                        <Button variant="secondary" onClick={() => setDialog("reopen")} leftIcon={<LockOpen className="size-4" aria-hidden="true" />}>
                            Rouvrir la période
                        </Button>
                    </div>
                )
            )}

            {outcome && (
                <BulkResult
                    title={outcome.kind === "generate" ? "Génération terminée" : outcome.kind === "calculate" ? "Calcul terminé" : "Validation terminée"}
                    successLabel={outcome.kind === "generate" ? "bulletin(s) créé(s)" : outcome.kind === "calculate" ? "bulletin(s) calculé(s)" : "bulletin(s) validé(s)"}
                    count={outcome.count}
                    errors={outcome.errors}
                    extra={outcome.extra}
                    onDismiss={() => setOutcome(null)}
                />
            )}

            <section className="space-y-3">
                <h2 className="text-2xl">Bulletins de la période</h2>
                <FilterBar canReset={status !== ""} onReset={() => { setStatus(""); setPage(1); }}>
                    <Select label="Statut" className="min-w-44" value={status} placeholder="Tous" onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                        <option value="DRAFT">Brouillon</option>
                        <option value="CALCULATED">Calculé</option>
                        <option value="VALIDATED">Validé</option>
                        <option value="PAID">Payé</option>
                        <option value="CANCELLED">Annulé</option>
                    </Select>
                </FilterBar>
                {payslips.error && <Alert tone="error">{payslips.error.message}</Alert>}
                <div aria-busy={payslips.loading || undefined} className={payslips.loading && payslips.data ? "opacity-60" : undefined}>
                    <PayslipsTable
                        caption={`Bulletins de la période ${period.code}`}
                        rows={payslips.data?.results ?? []}
                        loading={payslips.loading && !payslips.data}
                        showEmployee
                        showPeriod={false}
                        detailPath={(payslip) => `/payroll/payslips/${payslip.id}`}
                        emptyState={
                            <EmptyState
                                icon={Banknote}
                                title="Aucun bulletin"
                                description={open ? "Générez les bulletins des employés couverts par un contrat." : "Cette période ne contient aucun bulletin."}
                            />
                        }
                    />
                </div>
                <Pagination page={page} count={payslips.data?.count ?? 0} onPageChange={setPage} />
            </section>

            <PeriodFormModal open={editing} period={period} onClose={() => setEditing(false)} onSaved={refresh} />

            <ConfirmDialog
                open={dialog === "validate"}
                onClose={() => setDialog(null)}
                title="Valider les bulletins calculés ?"
                message={
                    <>
                        <p>Tous les bulletins <strong>calculés</strong> de la période seront validés, puis figés. Les bulletins en erreur sont listés après l'opération.</p>
                        <p className="mt-2 text-sm text-gray-dark">Vous ne pouvez pas valider votre propre bulletin.</p>
                    </>
                }
                reason={{ label: "Commentaire (facultatif)", maxLength: 500 }}
                confirmLabel="Valider"
                onConfirm={async (comment) => {
                    const result = await validatePeriod(periodId, comment);
                    setOutcome({ kind: "validate", count: result.validated, errors: result.errors });
                    refresh();
                }}
            />
            <ConfirmDialog
                open={dialog === "close"}
                onClose={() => setDialog(null)}
                title="Clôturer cette période ?"
                message="La clôture est refusée tant qu'il reste des bulletins brouillon ou calculés. Après clôture, seul un administrateur peut la rouvrir."
                confirmLabel="Clôturer"
                onConfirm={async () => {
                    await closePeriod(periodId);
                    notify.success("Période clôturée");
                    refresh();
                }}
            />
            <ConfirmDialog
                open={dialog === "reopen"}
                onClose={() => setDialog(null)}
                tone="danger"
                title="Rouvrir cette période ?"
                message="Procédure contrôlée : la période redevient modifiable (corrections, annulations). L'opération est enregistrée dans le journal d'audit."
                confirmLabel="Rouvrir"
                onConfirm={async () => {
                    await reopenPeriod(periodId);
                    notify.success("Période rouverte");
                    refresh();
                }}
            />
            <ConfirmDialog
                open={dialog === "delete"}
                onClose={() => setDialog(null)}
                tone="danger"
                title="Supprimer cette période ?"
                message="La suppression est irréversible et refusée si la période contient des bulletins (même annulés)."
                confirmLabel="Supprimer"
                onConfirm={async () => {
                    await deletePeriod(periodId);
                    notify.success("Période supprimée");
                    navigate("/payroll", { replace: true });
                }}
            />
        </>
    );
}