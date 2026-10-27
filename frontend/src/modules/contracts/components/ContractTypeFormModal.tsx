import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Checkbox, Input, Modal, ModalForm, Textarea } from "@/components/ui";
import { applyApiErrors } from "@/lib/forms";
import { notify } from "@/lib/notify";
import { createContractType, updateContractType } from "../services/contractService";
import type { ContractType } from "../types";

const schema = z.object({
    code: z.string().trim().min(1, "Le code est obligatoire.").max(20, "20 caractères maximum."),
    name: z.string().trim().min(1, "Le nom est obligatoire.").max(150, "150 caractères maximum."),
    description: z.string(),
    is_fixed_term: z.boolean(),
    is_active: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

interface BodyProps {
    contractType: ContractType | null;
    onClose: () => void;
    onSaved: () => void;
}

function ContractTypeFormBody({ contractType, onClose, onSaved }: BodyProps) {
    const [messages, setMessages] = useState<string[]>([]);
    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            code: contractType?.code ?? "",
            name: contractType?.name ?? "",
            description: contractType?.description ?? "",
            is_fixed_term: contractType?.is_fixed_term ?? false,
            is_active: contractType?.is_active ?? true,
        },
    });

    async function onSubmit(values: FormValues) {
        setMessages([]);
        const input = { ...values, code: values.code.toUpperCase() };
        try {
            if (contractType) await updateContractType(contractType.id, input);
            else await createContractType(input);
            notify.success(contractType ? "Type de contrat modifié" : "Type de contrat créé");
            onSaved();
            onClose();
        } catch (error) {
            setMessages(applyApiErrors(error, setError, ["code", "name", "description", "is_fixed_term", "is_active"]));
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
            <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Code" required hint="Ex. CDI, CDD." className="uppercase" autoFocus error={errors.code?.message} {...register("code")} />
                <Input label="Nom" required error={errors.name?.message} {...register("name")} />
            </div>
            <Textarea label="Description" error={errors.description?.message} {...register("description")} />
            <Checkbox
                label="Contrat à durée déterminée"
                hint="Si coché, la date de fin est obligatoire pour les contrats de ce type ; sinon elle est interdite."
                {...register("is_fixed_term")}
            />
            <Checkbox label="Type actif" hint="Un type inactif ne peut plus être choisi pour de nouveaux contrats." {...register("is_active")} />
        </ModalForm>
    );
}

export function ContractTypeFormModal({ open, ...body }: BodyProps & { open: boolean }) {
    return (
        <Modal
            open={open}
            onClose={body.onClose}
            title={body.contractType ? "Modifier le type de contrat" : "Nouveau type de contrat"}
            padded={false}
        >
            <ContractTypeFormBody {...body} />
        </Modal>
    );
}