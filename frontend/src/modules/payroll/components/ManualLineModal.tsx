import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Input, Modal, ModalForm, Select } from "@/components/ui";
import { DECIMAL_PATTERN, toDecimalString } from "@/lib/decimal";
import { applyApiErrors } from "@/lib/forms";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { notify } from "@/lib/notify";
import { CATEGORY_LABELS } from "../payrollLabels";
import { addManualLine, getAllPayItemTypes } from "../services/payrollService";

const schema = z.object({
    item_type: z.string().min(1, "Choisissez un type d'élément."),
    amount: z
        .string()
        .trim()
        .refine((value) => DECIMAL_PATTERN.test(value) && Number(value.replace(",", ".")) > 0, "Montant strictement positif (ex. 150 ou 150,50)."),
    note: z.string().max(200, "200 caractères maximum."),
});
type FormValues = z.infer<typeof schema>;

interface BodyProps {
    payslipId: number;
    onClose: () => void;
    onSaved: () => void;
}

function ManualLineBody({ payslipId, onClose, onSaved }: BodyProps) {
    const [messages, setMessages] = useState<string[]>([]);
    const types = useApiQuery(["pay-item-types-active"], (signal) => getAllPayItemTypes(signal, true));
    // Only fixed-amount types that are not applied automatically can be entered by hand.
    const options = (types.data ?? []).filter((type) => type.calculation === "FIXED" && !type.applies_to_all);
    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { item_type: "", amount: "", note: "" } });

    async function onSubmit(values: FormValues) {
        setMessages([]);
        try {
            await addManualLine(payslipId, {
                item_type: Number(values.item_type),
                amount: toDecimalString(values.amount),
                note: values.note.trim(),
            });
            notify.success("Ligne ajoutée", "Le bulletin a été recalculé.");
            onSaved();
            onClose();
        } catch (error) {
            setMessages(applyApiErrors(error, setError, ["item_type", "amount", "note"]));
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
                        Ajouter la ligne
                    </Button>
                </>
            }
        >
            <Alert tone="info">
                Élément ponctuel (prime, retenue…). Il est conservé à chaque recalcul et fait partie du bulletin avant sa validation.
            </Alert>
            {messages.length > 0 && (
                <Alert tone="error">
                    {messages.map((message) => (
                        <p key={message}>{message}</p>
                    ))}
                </Alert>
            )}
            <Select label="Type d'élément" required placeholder="Choisir…" error={errors.item_type?.message} {...register("item_type")}>
                {options.map((type) => (
                    <option key={type.id} value={type.id}>
                        {type.code} · {type.name} ({CATEGORY_LABELS[type.category]})
                    </option>
                ))}
            </Select>
            {types.data && options.length === 0 && (
                <Alert tone="warning">Aucun type à montant fixe disponible : créez-en un dans « Types d'éléments de paie ».</Alert>
            )}
            <Input label="Montant" required inputMode="decimal" error={errors.amount?.message} {...register("amount")} />
            <Input label="Note" hint="Facultative (apparaît sur la ligne)." error={errors.note?.message} {...register("note")} />
        </ModalForm>
    );
}

export function ManualLineModal({ open, ...body }: BodyProps & { open: boolean }) {
    return (
        <Modal open={open} onClose={body.onClose} title="Ajouter une ligne manuelle" padded={false}>
            <ManualLineBody {...body} />
        </Modal>
    );
}