import { useState, type ReactNode } from "react";
import { notify } from "@/lib/notify";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { Textarea } from "./Textarea";

export interface ConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    message: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: "default" | "danger";
    /** Adds a text field (cancellation reason, rejection comment...). */
    reason?: { label: string; required?: boolean; maxLength?: number; hint?: string };
    /** May be async. If it throws, the error is notified and the dialog stays open. */
    onConfirm: (reason: string) => Promise<void> | void;
}

function ConfirmBody({
    message,
    confirmLabel,
    cancelLabel,
    tone,
    reason,
    onConfirm,
    onClose,
}: Required<Pick<ConfirmDialogProps, "confirmLabel" | "cancelLabel" | "tone">> &
    Pick<ConfirmDialogProps, "message" | "reason" | "onConfirm" | "onClose">) {
    const [value, setValue] = useState("");
    const [error, setError] = useState<string>();
    const [busy, setBusy] = useState(false);

    async function handleConfirm() {
        if (reason?.required && value.trim() === "") {
            setError("Ce champ est obligatoire.");
            return;
        }
        setBusy(true);
        try {
            await onConfirm(value.trim());
        } catch (failure) {
            notify.error(failure);
            setBusy(false);
            return;
        }
        onClose();
    }

    return (
        <>
            <div className="space-y-4 p-5">
                <div>{message}</div>
                {reason && (
                    <Textarea
                        label={reason.label}
                        hint={reason.hint}
                        required={reason.required}
                        maxLength={reason.maxLength ?? 500}
                        value={value}
                        error={error}
                        onChange={(event) => {
                            setValue(event.target.value);
                            setError(undefined);
                        }}
                    />
                )}
            </div>
            <div className="flex flex-wrap justify-end gap-3 border-t-2 border-ink bg-gray-light p-4">
                <Button variant="secondary" onClick={onClose} disabled={busy}>
                    {cancelLabel}
                </Button>
                <Button variant={tone === "danger" ? "danger" : "primary"} onClick={handleConfirm} loading={busy}>
                    {confirmLabel}
                </Button>
            </div>
        </>
    );
}

/** Mandatory before any destructive or irreversible operation. */
export function ConfirmDialog({
    open,
    onClose,
    title,
    message,
    confirmLabel = "Confirmer",
    cancelLabel = "Annuler",
    tone = "default",
    reason,
    onConfirm,
}: ConfirmDialogProps) {
    return (
        <Modal open={open} onClose={onClose} title={title} size="sm" padded={false}>
            <ConfirmBody
                message={message}
                confirmLabel={confirmLabel}
                cancelLabel={cancelLabel}
                tone={tone}
                reason={reason}
                onConfirm={onConfirm}
                onClose={onClose}
            />
        </Modal>
    );
}