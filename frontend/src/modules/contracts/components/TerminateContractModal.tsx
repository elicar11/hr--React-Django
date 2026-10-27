import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, DateField, Modal, ModalForm } from "@/components/ui";
import { todayISO } from "@/lib/format";
import { applyApiErrors } from "@/lib/forms";
import { notify } from "@/lib/notify";
import { terminateContract } from "../services/contractService";
import type { Contract } from "../types";

const schema = z.object({ end_date: z.string().min(1, "La date de fin est obligatoire.") });
type FormValues = z.infer<typeof schema>;

interface BodyProps {
    contract: Contract;
    onClose: () => void;
    onSaved: () => void;
}

function TerminateBody({ contract, onClose, onSaved }: BodyProps) {
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
            await terminateContract(contract.id, values.end_date);
            notify.success("Contrat rompu");
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
                    <Button type="submit" variant="danger" loading={isSubmitting}>
                        Rompre le contrat
                    </Button>
                </>
            }
        >
            <Alert tone="warning" title="Opération irréversible">
                La rupture met fin au contrat <strong>{contract.reference}</strong> à la date choisie, avant son terme prévu.
            </Alert>
            {messages.length > 0 && (
                <Alert tone="error">
                    {messages.map((message) => (
                        <p key={message}>{message}</p>
                    ))}
                </Alert>
            )}
            <DateField label="Date de fin" required error={errors.end_date?.message} {...register("end_date")} />
        </ModalForm>
    );
}

export function TerminateContractModal({ open, ...body }: BodyProps & { open: boolean }) {
    return (
        <Modal open={open} onClose={body.onClose} title="Rompre le contrat" size="sm" padded={false}>
            <TerminateBody {...body} />
        </Modal>
    );
}