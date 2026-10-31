import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, DateField, Input, Modal, ModalForm } from "@/components/ui";
import { applyApiErrors } from "@/lib/forms";
import { notify } from "@/lib/notify";
import { createHoliday, updateHoliday } from "../services/scheduleService";
import type { Holiday } from "../types";

const schema = z.object({
    date: z.string().min(1, "La date est obligatoire."),
    name: z.string().trim().min(1, "Le nom est obligatoire.").max(150, "150 caractères maximum."),
});
type FormValues = z.infer<typeof schema>;

interface BodyProps {
    holiday: Holiday | null;
    onClose: () => void;
    onSaved: () => void;
}

function HolidayBody({ holiday, onClose, onSaved }: BodyProps) {
    const [messages, setMessages] = useState<string[]>([]);
    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { date: holiday?.date ?? "", name: holiday?.name ?? "" },
    });

    async function onSubmit(values: FormValues) {
        setMessages([]);
        try {
            if (holiday) await updateHoliday(holiday.id, values);
            else await createHoliday(values);
            notify.success(holiday ? "Jour férié modifié" : "Jour férié ajouté");
            onSaved();
            onClose();
        } catch (error) {
            setMessages(applyApiErrors(error, setError, ["date", "name"]));
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
            {messages.length > 0 && (
                <Alert tone="error">
                    {messages.map((message) => (
                        <p key={message}>{message}</p>
                    ))}
                </Alert>
            )}
            <DateField label="Date" required autoFocus error={errors.date?.message} {...register("date")} />
            <Input label="Nom" required error={errors.name?.message} {...register("name")} />
        </ModalForm>
    );
}

export function HolidayFormModal({ open, ...body }: BodyProps & { open: boolean }) {
    return (
        <Modal open={open} onClose={body.onClose} title={body.holiday ? "Modifier le jour férié" : "Nouveau jour férié"} size="sm" padded={false}>
            <HolidayBody {...body} />
        </Modal>
    );
}