import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, DateField, Input, Modal, ModalForm, Textarea } from "@/components/ui";
import { localDateTimeToISO, todayISO } from "@/lib/format";
import { applyApiErrors } from "@/lib/forms";
import { notify } from "@/lib/notify";
import { createCorrection } from "../services/attendanceService";

const schema = z.object({
    date: z.string().min(1, "La date est obligatoire."),
    check_in: z.string().min(1, "L'entrée est obligatoire."),
    check_out: z.string(),
    reason: z.string().trim().min(1, "Le motif est obligatoire.").max(500, "500 caractères maximum."),
});
type FormValues = z.infer<typeof schema>;

interface BodyProps {
    onClose: () => void;
    onSaved: () => void;
}

function CorrectionBody({ onClose, onSaved }: BodyProps) {
    const [messages, setMessages] = useState<string[]>([]);
    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { date: todayISO(), check_in: "", check_out: "", reason: "" },
    });

    async function onSubmit(values: FormValues) {
        setMessages([]);
        try {
            await createCorrection({
                date: values.date,
                check_in: localDateTimeToISO(values.check_in),
                check_out: values.check_out ? localDateTimeToISO(values.check_out) : null,
                reason: values.reason,
            });
            notify.success("Demande envoyée", "Elle sera examinée par les ressources humaines.");
            onSaved();
            onClose();
        } catch (error) {
            setMessages(applyApiErrors(error, setError, ["date", "check_in", "check_out", "reason"]));
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
                        Envoyer la demande
                    </Button>
                </>
            }
        >
            <Alert tone="info">
                Indiquez les horaires <strong>réels</strong> de la journée. Une demande n'est possible que pour les jours
                récents (30 jours par défaut), une seule à la fois par jour. Les RH la valident ou la refusent.
            </Alert>
            {messages.length > 0 && (
                <Alert tone="error">
                    {messages.map((message) => (
                        <p key={message}>{message}</p>
                    ))}
                </Alert>
            )}
            <DateField label="Jour concerné" required max={todayISO()} error={errors.date?.message} {...register("date")} />
            <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Entrée" type="datetime-local" required error={errors.check_in?.message} {...register("check_in")} />
                <Input label="Sortie" type="datetime-local" hint="Facultative." error={errors.check_out?.message} {...register("check_out")} />
            </div>
            <Textarea label="Motif" required rows={3} error={errors.reason?.message} {...register("reason")} />
        </ModalForm>
    );
}

export function CorrectionRequestModal({ open, ...body }: BodyProps & { open: boolean }) {
    return (
        <Modal open={open} onClose={body.onClose} title="Demander une correction de pointage" padded={false}>
            <CorrectionBody {...body} />
        </Modal>
    );
}