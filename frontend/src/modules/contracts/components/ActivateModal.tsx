import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, DateField, Modal, ModalForm } from "@/components/ui";
import { todayISO } from "@/lib/format";
import { applyApiErrors } from "@/lib/forms";
import { notify } from "@/lib/notify";
import { activateContract } from "../services/contractService";
import type { Contract } from "../types";

const schema = z.object({ signed_date: z.string().min(1, "La date de signature est obligatoire.") });
type FormValues = z.infer<typeof schema>;

interface BodyProps {
    contract: Contract;
    onClose: () => void;
    onSaved: () => void;
}

function ActivateBody({ contract, onClose, onSaved }: BodyProps) {
    const [messages, setMessages] = useState<string[]>([]);
    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { signed_date: todayISO() } });

    async function onSubmit(values: FormValues) {
        setMessages([]);
        try {
            await activateContract(contract.id, values.signed_date);
            notify.success("Contrat activé");
            onSaved();
            onClose();
        } catch (error) {
            setMessages(applyApiErrors(error, setError, ["signed_date"]));
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
                        Activer le contrat
                    </Button>
                </>
            }
        >
            <Alert tone="warning" title="Les conditions seront figées">
                Une fois signé, le contrat <strong>{contract.reference}</strong> n'est plus modifiable : pour changer ses
                conditions, il faudra le renouveler. S'il en renouvelle un autre, celui-ci prend fin la veille de son début.
            </Alert>
            {messages.length > 0 && (
                <Alert tone="error">
                    {messages.map((message) => (
                        <p key={message}>{message}</p>
                    ))}
                </Alert>
            )}
            <DateField
                label="Date de signature"
                required
                max={todayISO()}
                error={errors.signed_date?.message}
                {...register("signed_date")}
            />
        </ModalForm>
    );
}

export function ActivateModal({ open, ...body }: BodyProps & { open: boolean }) {
    return (
        <Modal open={open} onClose={body.onClose} title="Activer le contrat" size="sm" padded={false}>
            <ActivateBody {...body} />
        </Modal>
    );
}