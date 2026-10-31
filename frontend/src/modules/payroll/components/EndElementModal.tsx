import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, DateField, Modal, ModalForm } from "@/components/ui";
import { todayISO } from "@/lib/format";
import { applyApiErrors } from "@/lib/forms";
import { notify } from "@/lib/notify";
import { endPayElement } from "../services/payrollService";
import type { PayElement } from "../types";

const schema = z.object({ end_date: z.string().min(1, "La date de fin est obligatoire.") });
type FormValues = z.infer<typeof schema>;

interface BodyProps {
    element: PayElement;
    onClose: () => void;
    onSaved: () => void;
}

function EndBody({ element, onClose, onSaved }: BodyProps) {
    const [messages, setMessages] = useState<string[]>([]);
    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { end_date: todayISO() } });

    async function onSubmit(values: FormValues) {
        setMessages([]);
        try {
            await endPayElement(element.id, values.end_date);
            notify.success("Élément terminé");
            onSaved();
            onClose();
        } catch (error) {
            setMessages(applyApiErrors(error, setError, ["end_date"]));
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
                        Terminer l'élément
                    </Button>
                </>
            }
        >
            <Alert tone="info">
                L'élément « {element.item_type_name} » ({element.employee_matricule}) ne sera plus appliqué après cette date. Les bulletins déjà
                validés ne changent pas.
            </Alert>
            {messages.length > 0 && (
                <Alert tone="error">
                    {messages.map((message) => (
                        <p key={message}>{message}</p>
                    ))}
                </Alert>
            )}
            <DateField label="Dernier jour d'application" required min={element.start_date} error={errors.end_date?.message} {...register("end_date")} />
        </ModalForm>
    );
}

export function EndElementModal({ open, ...body }: BodyProps & { open: boolean }) {
    return (
        <Modal open={open} onClose={body.onClose} title="Terminer l'élément" size="sm" padded={false}>
            <EndBody {...body} />
        </Modal>
    );
}