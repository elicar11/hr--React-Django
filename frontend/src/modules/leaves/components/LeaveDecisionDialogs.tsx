import { ConfirmDialog } from "@/components/ui";
import { Trans, useTranslation } from "react-i18next";
import { formatDate, formatDecimal } from "@/lib/format";
import { notify } from "@/lib/notify";
import { approveLeave, cancelLeave, rejectLeave } from "../services/leaveService";
import type { LeaveRequest } from "../types";

export type DecisionKind = "approve" | "reject" | "cancel";
export interface DecisionTarget {
    leave: LeaveRequest;
    kind: DecisionKind;
}

/** Approve, reject and cancel dialogs, shared by the list and the detail page. */
export function LeaveDecisionDialogs({
    target,
    onClose,
    onDone,
}: {
    target: DecisionTarget | null;
    onClose: () => void;
    onDone: () => void;
}) {
    const { t } = useTranslation();
    const leave = target?.leave;
    const summary = leave ? (
        <>
            <Trans i18nKey="Demande de <strong>{{name}}</strong> : {{type}}, du {{start}} au {{end}} ({{days}} j)." values={{ name: leave.employee_name, type: leave.leave_type_name, start: formatDate(leave.start_date), end: formatDate(leave.end_date), days: formatDecimal(leave.days) }} components={{ strong: <strong /> }} />
        </>
    ) : null;

    return (
        <>
            <ConfirmDialog
                open={target?.kind === "approve"}
                onClose={onClose}
                title="Approuver ce congé ?"
                message={
                    <>
                        <p>{summary}</p>
                        <p className="mt-2 text-sm text-gray-dark">
                            {t("Les jours seront déduits du solde (si le type en a un). Vous ne pouvez pas approuver votre propre demande.")}
                        </p>
                    </>
                }
                reason={{ label: "Commentaire (facultatif)", maxLength: 500 }}
                confirmLabel="Approuver"
                onConfirm={async (comment) => {
                    if (!leave) return;
                    await approveLeave(leave.id, comment);
                    notify.success("Congé approuvé");
                    onDone();
                }}
            />
            <ConfirmDialog
                open={target?.kind === "reject"}
                onClose={onClose}
                tone="danger"
                title="Refuser ce congé ?"
                message={
                    <>
                        <p>{summary}</p>
                        <p className="mt-2 text-sm text-gray-dark">{t("Le motif du refus sera communiqué à l'employé.")}</p>
                    </>
                }
                reason={{ label: "Motif du refus", required: true, maxLength: 500 }}
                confirmLabel="Refuser"
                onConfirm={async (comment) => {
                    if (!leave) return;
                    await rejectLeave(leave.id, comment);
                    notify.success("Congé refusé");
                    onDone();
                }}
            />
            <ConfirmDialog
                open={target?.kind === "cancel"}
                onClose={onClose}
                tone="danger"
                title="Annuler cette demande ?"
                message={
                    <>
                        <p>{summary}</p>
                        <p className="mt-2 text-sm text-gray-dark">
                            {t("Si elle était approuvée, les jours sont rendus au solde. Un congé déjà commencé ne peut être annulé que par les RH.")}
                        </p>
                    </>
                }
                reason={{ label: "Commentaire (facultatif)", maxLength: 500 }}
                confirmLabel="Annuler la demande"
                cancelLabel="Conserver"
                onConfirm={async (comment) => {
                    if (!leave) return;
                    await cancelLeave(leave.id, comment);
                    notify.success("Demande annulée");
                    onDone();
                }}
            />
        </>
    );
}