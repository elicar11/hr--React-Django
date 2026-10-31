import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, DateField, Input, Modal, ModalForm } from "@/components/ui";
import { applyApiErrors } from "@/lib/forms";
import { notify } from "@/lib/notify";
import { createPeriod, updatePeriod } from "../services/payrollService";
import type { PayrollPeriod } from "../types";

const schema = z
    .object({
        code: z.string().trim().min(1, "Le code est obligatoire.").max(20, "20 caractères maximum."),
        name: z.string().trim().min(1, "Le nom est obligatoire.").max(150, "150 caractères maximum."),
        start_date: z.string().min(1, "La date de début est obligatoire."),
        end_date: z.string().min(1, "La date de fin est obligatoire."),
    })
    .refine((values) => values.end_date >= values.start_date, {
        path: ["end_date"],
        message: "La fin de période doit suivre son début.",
    });
type FormValues = z.infer<typeof schema>;

interface BodyProps {
    period: PayrollPeriod | null;
    onClose: () => void;
    onSaved: (period: PayrollPeriod) => void;
}

function PeriodFormBody({ period, onClose, onSaved }: BodyProps) {
    const [messages, setMessages] = useState<string[]>([]);
    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            code: period?.code ?? "",
            name: period?.name ?? "",
            start_date: period?.start_date ?? "",
            end_date: period?.end_date ?? "",
        },
    });

    async function onSubmit(values: FormValues) {
        setMessages([]);
        const input = { ...values, code: values.code.toUpperCase() };
        try {
            const saved = period ? await updatePeriod(period.id, input) : await createPeriod(input);
            notify.success(period ? "Période modifiée" : "Période créée");
            onSaved(saved);
            onClose();
        } catch (error) {
            setMessages(applyApiErrors(error, setError, ["code", "name", "start_date", "end_date"]));
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
                        Enregistrer
                    </Button>
                </>
            }
        >
            <Alert tone="info">
                Une période est clairement délimitée et ne peut pas en chevaucher une autre. Ses dates ne sont plus modifiables dès
                qu'elle contient des bulletins.
            </Alert>
            {messages.length > 0 && (
                <Alert tone="error">
                    {messages.map((message) => (
                        <p key={message}>{message}</p>
                    ))}
                </Alert>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Code" required hint="Ex. 2026-11." className="uppercase" autoFocus error={errors.code?.message} {...register("code")} />
                <Input label="Nom" required hint="Ex. Paie de novembre 2026." error={errors.name?.message} {...register("name")} />
                <DateField label="Début" required error={errors.start_date?.message} {...register("start_date")} />
                <DateField label="Fin" required error={errors.end_date?.message} {...register("end_date")} />
            </div>
        </ModalForm>
    );
}

export function PeriodFormModal({ open, ...body }: BodyProps & { open: boolean }) {
    return (
        <Modal open={open} onClose={body.onClose} title={body.period ? "Modifier la période" : "Nouvelle période de paie"} padded={false}>
            <PeriodFormBody {...body} />
        </Modal>
    );
}