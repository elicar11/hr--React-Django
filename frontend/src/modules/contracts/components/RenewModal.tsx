import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, DateField, Input, Modal, ModalForm, Select } from "@/components/ui";
import { addDaysISO, todayISO } from "@/lib/format";
import { applyApiErrors } from "@/lib/forms";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { notify } from "@/lib/notify";
import { getAllPositions } from "@/modules/organization/services/organizationService";
import { getAllContractTypes, renewContract } from "../services/contractService";
import type { Contract } from "../types";

const schema = z.object({
    reference: z.string().trim().min(1, "La référence est obligatoire.").max(20, "20 caractères maximum."),
    contract_type: z.string().min(1, "Choisissez un type de contrat."),
    position: z.string().min(1, "Choisissez un poste."),
    start_date: z.string().min(1, "La date de début est obligatoire."),
    end_date: z.string(),
    probation_days: z.string().refine((value) => value === "" || /^[1-9]\d*$/.test(value), "Nombre de jours entier."),
    base_salary: z
        .string()
        .trim()
        .refine((value) => /^\d+([.,]\d{1,2})?$/.test(value), "Montant invalide (ex. 1500 ou 1500,50)."),
    currency: z.string().trim().length(3, "Code devise à 3 lettres (ex. EUR)."),
});
type FormValues = z.infer<typeof schema>;

interface BodyProps {
    contract: Contract;
    onClose: () => void;
    onRenewed: (renewal: Contract) => void;
}

function RenewBody({ contract, onClose, onRenewed }: BodyProps) {
    const [messages, setMessages] = useState<string[]>([]);
    const types = useApiQuery(["contract-types-all"], (signal) => getAllContractTypes(signal, false));
    const positions = useApiQuery(["positions-active"], (signal) => getAllPositions(signal));
    const {
        register,
        handleSubmit,
        control,
        setValue,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            reference: "",
            contract_type: String(contract.contract_type),
            position: String(contract.position),
            // A renewal follows the contract without a gap.
            start_date: contract.end_date ? addDaysISO(contract.end_date, 1) : todayISO(),
            end_date: "",
            probation_days: "",
            base_salary: contract.base_salary,
            currency: contract.currency,
        },
    });
    const typeId = useWatch({ control, name: "contract_type" });
    const fixedTerm = types.data?.find((type) => String(type.id) === typeId)?.is_fixed_term ?? false;

    async function onSubmit(values: FormValues) {
        setMessages([]);
        if (fixedTerm && !values.end_date) {
            return setError("end_date", { message: "La date de fin est obligatoire pour un contrat à durée déterminée." });
        }
        try {
            const renewal = await renewContract(contract.id, {
                reference: values.reference.toUpperCase(),
                start_date: values.start_date,
                end_date: fixedTerm ? values.end_date : null,
                contract_type: Number(values.contract_type),
                position: Number(values.position),
                base_salary: values.base_salary.replace(",", "."), // decimal string, never a float
                currency: values.currency.toUpperCase(),
                probation_days: values.probation_days ? Number(values.probation_days) : null,
            });
            notify.success("Renouvellement créé", "Le nouveau contrat est en brouillon : il reste à l'activer.");
            onRenewed(renewal);
            onClose();
        } catch (error) {
            setMessages(
                applyApiErrors(error, setError, [
                    "reference", "contract_type", "position", "start_date", "end_date", "probation_days", "base_salary", "currency",
                ]),
            );
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
                        Créer le renouvellement
                    </Button>
                </>
            }
        >
            <Alert tone="info">
                Le contrat <strong>{contract.reference}</strong> n'est pas modifié : un nouveau contrat en brouillon est créé et
                lié à celui-ci. À son activation, l'ancien contrat prend fin la veille de son début.
            </Alert>
            {messages.length > 0 && (
                <Alert tone="error">
                    {messages.map((message) => (
                        <p key={message}>{message}</p>
                    ))}
                </Alert>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Référence" required className="uppercase" error={errors.reference?.message} {...register("reference")} />
                <Select
                    label="Type de contrat"
                    required
                    error={errors.contract_type?.message}
                    {...register("contract_type", { onChange: () => setValue("end_date", "") })}
                >
                    {(types.data ?? [])
                        .filter((type) => type.is_active || type.id === contract.contract_type)
                        .map((type) => (
                            <option key={type.id} value={type.id}>
                                {type.code} · {type.name}
                            </option>
                        ))}
                </Select>
                <DateField label="Début" required error={errors.start_date?.message} {...register("start_date")} />
                <DateField
                    label="Fin"
                    required={fixedTerm}
                    disabled={!fixedTerm}
                    hint={fixedTerm ? undefined : "Durée indéterminée : pas de date de fin."}
                    error={errors.end_date?.message}
                    {...register("end_date")}
                />
                <Select label="Poste" required error={errors.position?.message} {...register("position")}>
                    {(positions.data ?? []).map((position) => (
                        <option key={position.id} value={position.id}>
                            {position.code} · {position.title}
                        </option>
                    ))}
                </Select>
                <Input label="Période d'essai (jours)" inputMode="numeric" error={errors.probation_days?.message} {...register("probation_days")} />
                <Input label="Rémunération de base" required inputMode="decimal" error={errors.base_salary?.message} {...register("base_salary")} />
                <Input label="Devise" required className="uppercase" maxLength={3} error={errors.currency?.message} {...register("currency")} />
            </div>
        </ModalForm>
    );
}

export function RenewModal({ open, ...body }: BodyProps & { open: boolean }) {
    return (
        <Modal open={open} onClose={body.onClose} title="Renouveler le contrat" size="lg" padded={false}>
            <RenewBody {...body} />
        </Modal>
    );
}