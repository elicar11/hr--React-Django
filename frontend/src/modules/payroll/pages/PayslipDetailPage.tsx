import { Ban, Calculator, CircleCheck, FileX, HandCoins, History, Plus, ReceiptText, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import {
    Alert,
    Badge,
    Button,
    Card,
    ConfirmDialog,
    DefinitionList,
    EmptyState,
    PageHeader,
    Skeleton,
    StatusBadge,
    TabPanel,
    Tabs,
    buttonStyles,
} from "@/components/ui";
import { formatDate, formatDateTime, formatDecimal, formatMinutes, formatMoney } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { notify } from "@/lib/notify";
import { useSession } from "@/modules/auth/sessionContext";
import { ManualLineModal } from "../components/ManualLineModal";
import { PayModal } from "../components/PayModal";
import { PayrollBanner } from "../components/PayrollBanner";
import { PayslipView } from "../components/PayslipView";
import { METHOD_LABELS } from "../payrollLabels";
import {
    calculatePayslip,
    cancelPayslip,
    getPayslip,
    getPayslipHistory,
    removeManualLine,
    validatePayslip,
} from "../services/payrollService";
import type { PayslipHistoryEntry, PayslipLine } from "../types";

const TABS = [
    { id: "payslip", label: "Bulletin", icon: ReceiptText },
    { id: "calculation", label: "Calcul", icon: SlidersHorizontal },
    { id: "history", label: "Historique", icon: History },
];

const ACTIONS: Record<PayslipHistoryEntry["action"], string> = {
    CREATED: "Bulletin créé",
    CALCULATED: "Bulletin calculé",
    LINE_ADDED: "Ligne manuelle ajoutée",
    LINE_REMOVED: "Ligne manuelle retirée",
    VALIDATED: "Bulletin validé",
    PAID: "Bulletin payé",
    CANCELLED: "Bulletin annulé",
};

function HistoryTab({ payslipId, version }: { payslipId: number; version: number }) {
    const query = useApiQuery(["payslip-history", payslipId, version], (signal) => getPayslipHistory(payslipId, signal));
    return (
        <div className="space-y-4">
            {query.error && <Alert tone="error">{query.error.message}</Alert>}
            {!query.data && query.loading && <Skeleton className="h-32" />}
            {query.data && query.data.length === 0 && <EmptyState icon={History} title="Aucun événement" />}
            {query.data && query.data.length > 0 && (
                <ol className="divide-y-2 divide-ink border-2 border-ink bg-paper">
                    {query.data.map((entry) => (
                        <li key={entry.id} className="space-y-1 p-3">
                            <div className="flex flex-wrap items-center gap-3">
                                <p className="font-bold">{ACTIONS[entry.action] ?? entry.action}</p>
                                {entry.from_status && entry.to_status && entry.from_status !== entry.to_status && (
                                    <span className="flex items-center gap-2 text-sm">
                                        <StatusBadge domain="payslip" status={entry.from_status} /> → <StatusBadge domain="payslip" status={entry.to_status} />
                                    </span>
                                )}
                            </div>
                            {entry.comment && <p className="text-sm">« {entry.comment} »</p>}
                            <p className="text-sm text-gray-dark">
                                {entry.actor_email || "Système"} · <time dateTime={entry.created_at}>{formatDateTime(entry.created_at)}</time>
                            </p>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}

/**
 * Detail of a payslip. ADMIN / HR get every action and the technical tabs;
 * an employee only sees their own validated or paid payslips (the API answers 404 to anyone else).
 */
export function PayslipDetailPage() {
    const { id } = useParams();
    const payslipId = Number(id);
    const { user } = useSession();
    const staff = user.role === "ADMIN" || user.role === "HR";
    const [searchParams, setSearchParams] = useSearchParams();
    const [version, setVersion] = useState(0);
    const refresh = () => setVersion((current) => current + 1);
    const [dialog, setDialog] = useState<"validate" | "cancel" | null>(null);
    const [lineToRemove, setLineToRemove] = useState<PayslipLine | null>(null);
    const [addingLine, setAddingLine] = useState(false);
    const [paying, setPaying] = useState(false);
    const [calculating, setCalculating] = useState(false);

    const query = useApiQuery(["payslip", payslipId, version], (signal) => getPayslip(payslipId, signal));
    const payslip = query.data;
    const requestedTab = searchParams.get("tab");
    const tab = TABS.some((item) => item.id === requestedTab) ? (requestedTab as string) : "payslip";
    const backTo = staff ? "/payroll" : "/my/payslips";

    if (query.error && !payslip) {
        return (
            <>
                <PageHeader title="Bulletin de paie" />
                <EmptyState
                    icon={FileX}
                    title={query.error.status === 404 ? "Bulletin introuvable" : "Chargement impossible"}
                    description={query.error.message}
                    action={<Link to={backTo} className={buttonStyles()}>Retour</Link>}
                />
            </>
        );
    }
    if (!payslip) return <Skeleton className="h-96" />;

    const editable = staff && (payslip.status === "DRAFT" || payslip.status === "CALCULATED");
    const canCancel = staff && (payslip.status === "DRAFT" || payslip.status === "CALCULATED" || (payslip.status === "VALIDATED" && user.role === "ADMIN"));
    const context = payslip.calculation_context;

    async function recalculate() {
        setCalculating(true);
        try {
            await calculatePayslip(payslipId);
            notify.success("Bulletin calculé");
            refresh();
        } catch (error) {
            notify.error(error);
        } finally {
            setCalculating(false);
        }
    }

    return (
        <>
            <PageHeader
                title={`Bulletin ${payslip.reference}`}
                description={`${payslip.employee_name} · ${payslip.department_name} · période ${payslip.period_code} (${formatDate(payslip.period_start)} → ${formatDate(payslip.period_end)})`}
                breadcrumb={
                    staff
                        ? [{ label: "Paie", to: "/payroll" }, { label: payslip.period_code, to: `/payroll/periods/${payslip.period}` }, { label: payslip.reference }]
                        : [{ label: "Mes bulletins", to: "/my/payslips" }, { label: payslip.reference }]
                }
                actions={
                    staff ? (
                        <>
                            {editable && (
                                <>
                                    <Button variant="secondary" loading={calculating} onClick={() => void recalculate()} leftIcon={<Calculator className="size-4" aria-hidden="true" />}>
                                        {payslip.status === "DRAFT" ? "Calculer" : "Recalculer"}
                                    </Button>
                                    <Button variant="secondary" onClick={() => setAddingLine(true)} leftIcon={<Plus className="size-4" aria-hidden="true" />}>
                                        Ligne manuelle
                                    </Button>
                                </>
                            )}
                            {payslip.status === "CALCULATED" && (
                                <Button onClick={() => setDialog("validate")} leftIcon={<CircleCheck className="size-4" aria-hidden="true" />}>
                                    Valider
                                </Button>
                            )}
                            {payslip.status === "VALIDATED" && (
                                <Button onClick={() => setPaying(true)} leftIcon={<HandCoins className="size-4" aria-hidden="true" />}>
                                    Enregistrer le paiement
                                </Button>
                            )}
                            {canCancel && (
                                <Button variant="danger" onClick={() => setDialog("cancel")} leftIcon={<Ban className="size-4" aria-hidden="true" />}>
                                    Annuler le bulletin
                                </Button>
                            )}
                        </>
                    ) : undefined
                }
            />
            {staff && <PayrollBanner />}

            {payslip.is_demo && (
                <Alert tone="warning" title="DÉMO : bulletin non utilisable pour une paie réelle" className="mb-4">
                    {payslip.demo_warning ?? "Ce bulletin a été calculé avec des paramètres fictifs."}
                </Alert>
            )}
            {query.error && <Alert tone="error" className="mb-4">{query.error.message}</Alert>}

            <div className="mb-6 flex flex-wrap items-center gap-3">
                <StatusBadge domain="payslip" status={payslip.status} />
                {payslip.revision > 1 && <Badge tone="outline">Révision {payslip.revision}</Badge>}
                {payslip.validated_at && <span className="text-sm text-gray-dark">Validé le {formatDateTime(payslip.validated_at)}</span>}
            </div>

            {staff && payslip.status === "VALIDATED" && user.role !== "ADMIN" && (
                <Alert tone="info" className="mb-4">L'annulation d'un bulletin validé est réservée à un administrateur.</Alert>
            )}
            {staff && payslip.status === "PAID" && (
                <Alert tone="info" className="mb-4">Un bulletin payé ne peut pas être annulé : régularisez par un élément dans une période ultérieure.</Alert>
            )}
            {staff && payslip.status === "CANCELLED" && (
                <Alert tone="warning" title="Bulletin annulé" className="mb-4">
                    {payslip.cancelled_at ? `Annulé le ${formatDateTime(payslip.cancelled_at)}. ` : ""}
                    {payslip.cancel_reason && <>Motif : {payslip.cancel_reason}</>}
                </Alert>
            )}

            {payslip.payment && (
                <Card title="Paiement" className="mb-6">
                    <DefinitionList
                        items={[
                            { label: "Mode", value: METHOD_LABELS[payslip.payment.method] },
                            { label: "Date", value: formatDate(payslip.payment.payment_date) },
                            { label: "Montant", value: formatMoney(payslip.payment.amount, payslip.currency) },
                        ]}
                    />
                </Card>
            )}

            {staff ? (
                <>
                    <Tabs
                        idPrefix="payslip"
                        label="Sections du bulletin"
                        items={TABS}
                        value={tab}
                        onChange={(next) => {
                            const params = new URLSearchParams(searchParams);
                            if (next === "payslip") params.delete("tab");
                            else params.set("tab", next);
                            setSearchParams(params, { replace: true });
                        }}
                    />
                    <TabPanel idPrefix="payslip" id="payslip" active={tab === "payslip"}>
                        <PayslipView payslip={payslip} onRemoveLine={editable ? setLineToRemove : undefined} />
                    </TabPanel>
                    <TabPanel idPrefix="payslip" id="calculation" active={tab === "calculation"}>
                        <Card title="Contexte du calcul" description="Ce que le moteur a utilisé lors du dernier calcul.">
                            {payslip.calculated_at ? (
                                <DefinitionList
                                    items={[
                                        { label: "Calculé le", value: formatDateTime(payslip.calculated_at) },
                                        { label: "Devise", value: context?.settings?.currency ?? "" },
                                        { label: "Contrats pris en compte", value: context?.contracts?.join(", ") ?? "" },
                                        { label: "Jours ouvrés de la période", value: context?.working_days_in_period !== undefined ? String(context.working_days_in_period) : "" },
                                        { label: "Heures supplémentaires (présences)", value: context?.overtime_minutes ? formatMinutes(context.overtime_minutes) : "Aucune" },
                                        { label: "Jours de congé sans solde", value: context?.unpaid_leave_days ? String(context.unpaid_leave_days) : "Aucun" },
                                        { label: "Heures mensuelles de référence", value: context?.settings?.monthly_hours ? formatDecimal(context.settings.monthly_hours) : "" },
                                        { label: "Majoration des heures sup", value: context?.settings?.overtime_multiplier ? formatDecimal(context.settings.overtime_multiplier) : "" },
                                        { label: "Prorata", value: context?.settings?.prorate_partial_periods === undefined ? "" : context.settings.prorate_partial_periods ? "Activé" : "Désactivé" },
                                        { label: "Paramètres", value: context?.settings?.is_demo ? "Démonstration (fictifs)" : "Réels" },
                                    ]}
                                />
                            ) : (
                                <p className="text-gray-dark">Ce bulletin n'a pas encore été calculé.</p>
                            )}
                        </Card>
                    </TabPanel>
                    <TabPanel idPrefix="payslip" id="history" active={tab === "history"}>
                        <HistoryTab payslipId={payslip.id} version={version} />
                    </TabPanel>
                </>
            ) : (
                <PayslipView payslip={payslip} />
            )}

            <ManualLineModal open={addingLine} payslipId={payslip.id} onClose={() => setAddingLine(false)} onSaved={refresh} />
            <PayModal open={paying} payslip={payslip} onClose={() => setPaying(false)} onSaved={refresh} />

            <ConfirmDialog
                open={dialog === "validate"}
                onClose={() => setDialog(null)}
                title="Valider ce bulletin ?"
                message={
                    <>
                        <p>Net à payer : <strong>{formatMoney(payslip.net_pay, payslip.currency)}</strong>. Une fois validé, le bulletin est <strong>figé</strong> : ses lignes et ses montants ne peuvent plus changer.</p>
                        <p className="mt-2 text-sm text-gray-dark">
                            Le serveur refait le calcul avant de valider : si les données ont changé depuis, il demandera de recalculer. Vous ne pouvez pas valider votre propre bulletin.
                        </p>
                    </>
                }
                reason={{ label: "Commentaire (facultatif)", maxLength: 500 }}
                confirmLabel="Valider"
                onConfirm={async (comment) => {
                    await validatePayslip(payslipId, comment);
                    notify.success("Bulletin validé");
                    refresh();
                }}
            />
            <ConfirmDialog
                open={dialog === "cancel"}
                onClose={() => setDialog(null)}
                tone="danger"
                title="Annuler ce bulletin ?"
                message={
                    <>
                        <p>L'annulation est une procédure contrôlée, enregistrée dans l'historique. Un nouveau bulletin (révision suivante) pourra être généré pour la période.</p>
                        {payslip.status === "VALIDATED" && <p className="mt-2 font-bold">Ce bulletin est validé : seul un administrateur peut l'annuler.</p>}
                    </>
                }
                reason={{ label: "Motif de l'annulation", required: true, maxLength: 500 }}
                confirmLabel="Annuler le bulletin"
                cancelLabel="Conserver"
                onConfirm={async (reason) => {
                    await cancelPayslip(payslipId, reason);
                    notify.success("Bulletin annulé");
                    refresh();
                }}
            />
            <ConfirmDialog
                open={lineToRemove !== null}
                onClose={() => setLineToRemove(null)}
                tone="danger"
                title="Retirer cette ligne ?"
                message={
                    <>
                        La ligne <strong>{lineToRemove?.label}</strong> sera retirée et le bulletin recalculé.
                    </>
                }
                confirmLabel="Retirer"
                onConfirm={async () => {
                    if (!lineToRemove) return;
                    await removeManualLine(payslipId, lineToRemove.id);
                    notify.success("Ligne retirée");
                    refresh();
                }}
            />
        </>
    );
}