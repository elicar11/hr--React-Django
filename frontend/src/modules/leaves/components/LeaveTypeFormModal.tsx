import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Checkbox, Input, Modal, ModalForm, Select, Textarea } from "@/components/ui";
import { DECIMAL_PATTERN, toDecimalString } from "@/lib/decimal";
import { applyApiErrors } from "@/lib/forms";
import { notify } from "@/lib/notify";
import { createLeaveType, updateLeaveType } from "../services/leaveService";
import type { LeaveType } from "../types";

const schema = z.object({
    code: z.string().trim().min(1, "Le code est obligatoire.").max(20, "20 caractères maximum."),
    name: z.string().trim().min(1, "Le nom est obligatoire.").max(150, "150 caractères maximum."),
    description: z.string(),
    day_count_mode: z.enum(["WORKING_DAYS", "CALENDAR_DAYS"]),
    uses_balance: z.boolean(),
    annual_allowance: z.string().refine((value) => value.trim() === "" || DECIMAL_PATTERN.test(value.trim()), "Nombre de jours invalide (ex. 25 ou 2,5)."),
    requires_document: z.boolean(),
    is_paid: z.boolean(),
    is_active: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

const FIELDS = [
    "code", "name", "description", "day_count_mode", "uses_balance", "annual_allowance",
    "requires_document", "is_paid", "is_active",
] as const;

interface BodyProps {
    leaveType: LeaveType | null;
    onClose: () => void;
    onSaved: () => void;
}

function LeaveTypeFormBody({ leaveType, onClose, onSaved }: BodyProps) {
    const [messages, setMessages] = useState<string[]>([]);
    const {
        register,
        handleSubmit,
        control,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            code: leaveType?.code ?? "",
            name: leaveType?.name ?? "",
            description: leaveType?.description ?? "",
            day_count_mode: leaveType?.day_count_mode ?? "WORKING_DAYS",
            uses_balance: leaveType?.uses_balance ?? true,
            annual_allowance: leaveType?.annual_allowance ?? "",
            requires_document: leaveType?.requires_document ?? false,
            is_paid: leaveType?.is_paid ?? true,
            is_active: leaveType?.is_active ?? true,
        },
    });
    const usesBalance = useWatch({ control, name: "uses_balance" });

    async function onSubmit(values: FormValues) {
        setMessages([]);
        const input = {
            ...values,
            code: values.code.toUpperCase(),
            // An allowance only makes sense for a type limited by a balance.
            annual_allowance: values.uses_balance && values.annual_allowance.trim() ? toDecimalString(values.annual_allowance) : null,
        };
        try {
            if (leaveType) await updateLeaveType(leaveType.id, input);
            else await createLeaveType(input);
            notify.success(leaveType ? "Type de congé modifié" : "Type de congé créé");
            onSaved();
            onClose();
        } catch (error) {
            setMessages(applyApiErrors(error, setError, FIELDS));
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
                <Input label="Code" required hint="Ex. CA, MAL." className="uppercase" autoFocus error={errors.code?.message} {...register("code")} />
                <Input label="Nom" required error={errors.name?.message} {...register("name")} />
            </div>
            <Textarea label="Description" rows={2} error={errors.description?.message} {...register("description")} />
            <Select label="Mode de décompte" required error={errors.day_count_mode?.message} {...register("day_count_mode")}>
                <option value="WORKING_DAYS">Jours ouvrés (horaire de l'employé, jours fériés exclus)</option>
                <option value="CALENDAR_DAYS">Jours calendaires (tous les jours)</option>
            </Select>
            <Checkbox
                label="Décompté d'un solde"
                hint="Sinon le type n'est pas limité (par exemple un congé maladie)."
                {...register("uses_balance")}
            />
            <Input
                label="Allocation annuelle (jours)"
                inputMode="decimal"
                disabled={!usesBalance}
                hint="Utilisée pour initialiser les soldes d'une année. Facultative : aucune valeur n'est supposée."
                error={errors.annual_allowance?.message}
                {...register("annual_allowance")}
            />
            <Checkbox label="Justificatif obligatoire" hint="Sans justificatif, la demande ne peut pas être approuvée." {...register("requires_document")} />
            <Checkbox label="Congé payé" hint="Information transmise à la paie : un congé non payé réduit le brut." {...register("is_paid")} />
            <Checkbox label="Type actif" hint="Un type inactif ne peut plus être choisi pour de nouvelles demandes." {...register("is_active")} />
        </ModalForm>
    );
}

export function LeaveTypeFormModal({ open, ...body }: BodyProps & { open: boolean }) {
    return (
        <Modal open={open} onClose={body.onClose} title={body.leaveType ? "Modifier le type de congé" : "Nouveau type de congé"} padded={false}>
            <LeaveTypeFormBody {...body} />
        </Modal>
    );
}