import { ConfirmDialog } from "@/components/ui";
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
    const leave = target?.leave;
    const summary = leave ? (
        <>
            Demande de <strong>{leave.employee_name}</strong> : {leave.leave_type_name}, du {formatDate(leave.start_date)} au{" "}
            {formatDate(leave.end_date)} ({formatDecimal(leave.days)} j).
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
                            Les jours seront déduits du solde (si le type en a un). Vous ne pouvez pas approuver votre propre demande.
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
                        <p className="mt-2 text-sm text-gray-dark">Le motif du refus sera communiqué à l'employé.</p>
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
                            Si elle était approuvée, les jours sont rendus au solde. Un congé déjà commencé ne peut être annulé que par les RH.
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