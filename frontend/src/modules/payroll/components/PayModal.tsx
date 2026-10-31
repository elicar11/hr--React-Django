import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, DateField, Input, Modal, ModalForm, Select } from "@/components/ui";
import { formatMoney, todayISO } from "@/lib/format";
import { applyApiErrors } from "@/lib/forms";
import { notify } from "@/lib/notify";
import { METHOD_LABELS } from "../payrollLabels";
import { payPayslip } from "../services/payrollService";
import type { PaymentMethod, Payslip } from "../types";

const schema = z.object({
    method: z.enum(["BANK_TRANSFER", "MOBILE_MONEY", "CASH", "OTHER"]),
    payment_date: z.string().min(1, "La date de paiement est obligatoire."),
    reference: z.string().max(100, "100 caractères maximum."),
});
type FormValues = z.infer<typeof schema>;

interface BodyProps {
    payslip: Payslip;
    onClose: () => void;
    onSaved: () => void;
}

function PayBody({ payslip, onClose, onSaved }: BodyProps) {
    const [messages, setMessages] = useState<string[]>([]);
    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { method: "BANK_TRANSFER", payment_date: todayISO(), reference: "" },
    });

    async function onSubmit(values: FormValues) {
        setMessages([]);
        try {
            await payPayslip(payslip.id, { ...values, reference: values.reference.trim() });
            notify.success("Paiement enregistré");
            onSaved();
            onClose();
        } catch (error) {
            setMessages(applyApiErrors(error, setError, ["method", "payment_date", "reference"]));
        }
    }

    return (
        <ModalForm
            onSubmit={handleSubmit(onSubmit)}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
                        Annuler
                    </Button>
                    <Button type="submit" loading={isSubmitting}>
                        Enregistrer le paiement
                    </Button>
                </>
            }
        >
            <Alert tone="info">
                Enregistre le règlement du net à payer : <strong>{formatMoney(payslip.net_pay, payslip.currency)}</strong>. Ce n'est pas un virement
                : aucune coordonnée bancaire n'est conservée par l'application.
            </Alert>
            {messages.length > 0 && (
                <Alert tone="error">
                    {messages.map((message) => (
                        <p key={message}>{message}</p>
                    ))}
                </Alert>
            )}
            <Select label="Mode de paiement" required error={errors.method?.message} {...register("method")}>
                {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((method) => (
                    <option key={method} value={method}>
                        {METHOD_LABELS[method]}
                    </option>
                ))}
            </Select>
            <DateField label="Date de paiement" required max={todayISO()} error={errors.payment_date?.message} {...register("payment_date")} />
            <Input
                label="Référence de l'opération"
                hint="Facultative. Ne saisissez aucun numéro de compte bancaire."
                error={errors.reference?.message}
                {...register("reference")}
            />
        </ModalForm>
    );
}

export function PayModal({ open, ...body }: BodyProps & { open: boolean }) {
    return (
        <Modal open={open} onClose={body.onClose} title="Enregistrer le paiement" size="sm" padded={false}>
            <PayBody {...body} />
        </Modal>
    );
}