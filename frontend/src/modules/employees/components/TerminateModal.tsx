import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, DateField, Modal, ModalForm } from "@/components/ui";
import { todayISO } from "@/lib/format";
import { applyApiErrors } from "@/lib/forms";
import { notify } from "@/lib/notify";
import { terminateEmployee } from "../services/employeeService";
import type { Employee } from "../types";

const schema = z.object({ departure_date: z.string().min(1, "La date de départ est obligatoire.") });
type FormValues = z.infer<typeof schema>;

interface BodyProps {
    employee: Employee;
    onClose: () => void;
    onSaved: () => void;
}

function TerminateBody({ employee, onClose, onSaved }: BodyProps) {
    const [messages, setMessages] = useState<string[]>([]);
    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { departure_date: todayISO() } });

    async function onSubmit(values: FormValues) {
        setMessages([]);
        try {
            await terminateEmployee(employee.id, values.departure_date);
            notify.success("Sortie enregistrée");
            onSaved();
            onClose();
        } catch (error) {
            setMessages(applyApiErrors(error, setError, ["departure_date"]));
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
                    <Button type="submit" variant="danger" loading={isSubmitting}>
                        Enregistrer la sortie
                    </Button>
                </>
            }
        >
            <Alert tone="warning" title="Opération structurante">
                La sortie de <strong>{employee.first_name} {employee.last_name}</strong> clôt son affectation et ses contrats en
                cours, annule ses congés à venir et <strong>désactive son compte de connexion</strong>.
            </Alert>
            {messages.length > 0 && (
                <Alert tone="error">
                    {messages.map((message) => (
                        <p key={message}>{message}</p>
                    ))}
                </Alert>
            )}
            <DateField label="Date de départ" required error={errors.departure_date?.message} {...register("departure_date")} />
        </ModalForm>
    );
}

export function TerminateModal({ open, ...body }: BodyProps & { open: boolean }) {
    return (
        <Modal open={open} onClose={body.onClose} title="Enregistrer la sortie" size="sm" padded={false}>
            <TerminateBody {...body} />
        </Modal>
    );
}