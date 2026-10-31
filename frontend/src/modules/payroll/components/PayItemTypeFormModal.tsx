import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Checkbox, Input, Modal, ModalForm, Select } from "@/components/ui";
import { DECIMAL_PATTERN, RATE_PATTERN, toDecimalString } from "@/lib/decimal";
import { applyApiErrors } from "@/lib/forms";
import { notify } from "@/lib/notify";
import { CALCULATION_LABELS, CATEGORY_LABELS, SYSTEM_CATEGORY, isSystemCalculation } from "../payrollLabels";
import { createPayItemType, updatePayItemType } from "../services/payrollService";
import type { PayItemCalculation, PayItemCategory, PayItemType } from "../types";

const schema = z.object({
    code: z.string().trim().min(1, "Le code est obligatoire.").max(20, "20 caractères maximum."),
    name: z.string().trim().min(1, "Le nom est obligatoire.").max(150, "150 caractères maximum."),
    category: z.string().min(1, "Choisissez une catégorie."),
    calculation: z.string().min(1, "Choisissez un mode de calcul."),
    default_amount: z.string().refine((value) => value.trim() === "" || DECIMAL_PATTERN.test(value.trim()), "Montant invalide (ex. 50 ou 50,25)."),
    default_rate: z.string().refine((value) => value.trim() === "" || RATE_PATTERN.test(value.trim()), "Taux invalide (jusqu'à 4 décimales)."),
    applies_to_all: z.boolean(),
    is_active: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

const FIELDS = ["code", "name", "category", "calculation", "default_amount", "default_rate", "applies_to_all", "is_active"] as const;

interface BodyProps {
    payItemType: PayItemType | null;
    onClose: () => void;
    onSaved: () => void;
}

function PayItemTypeFormBody({ payItemType, onClose, onSaved }: BodyProps) {
    const [messages, setMessages] = useState<string[]>([]);
    const {
        register,
        handleSubmit,
        control,
        getValues,
        setValue,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            code: payItemType?.code ?? "",
            name: payItemType?.name ?? "",
            category: payItemType?.category ?? "BONUS",
            calculation: payItemType?.calculation ?? "FIXED",
            default_amount: payItemType?.default_amount ?? "",
            default_rate: payItemType?.default_rate ?? "",
            applies_to_all: payItemType?.applies_to_all ?? false,
            is_active: payItemType?.is_active ?? true,
        },
    });
    const calculation = useWatch({ control, name: "calculation" }) as PayItemCalculation;
    const system = isSystemCalculation(calculation);
    const percent = calculation === "PERCENT_OF_BASE" || calculation === "PERCENT_OF_GROSS";

    // System calculations need a given category; the others cannot use the two reserved ones.
    const categories = (Object.keys(CATEGORY_LABELS) as PayItemCategory[]).filter((category) =>
        system ? category === SYSTEM_CATEGORY[calculation] : category !== "BASE_SALARY" && category !== "OVERTIME",
    );

    function onCalculationChange(value: string) {
        const forced = SYSTEM_CATEGORY[value as PayItemCalculation];
        if (forced) setValue("category", forced);
        else if (getValues("category") === "BASE_SALARY" || getValues("category") === "OVERTIME") setValue("category", "BONUS");
    }

    async function onSubmit(values: FormValues) {
        setMessages([]);
        const input = {
            code: values.code.toUpperCase(),
            name: values.name,
            category: values.category as PayItemCategory,
            calculation: values.calculation as PayItemCalculation,
            default_amount: !system && !percent && values.default_amount.trim() ? toDecimalString(values.default_amount) : null,
            default_rate: !system && percent && values.default_rate.trim() ? toDecimalString(values.default_rate) : null,
            applies_to_all: system ? false : values.applies_to_all,
            is_active: values.is_active,
        };
        try {
            if (payItemType) await updatePayItemType(payItemType.id, input);
            else await createPayItemType(input);
            notify.success(payItemType ? "Type modifié" : "Type créé");
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
                <Input label="Code" required className="uppercase" autoFocus error={errors.code?.message} {...register("code")} />
                <Input label="Nom" required error={errors.name?.message} {...register("name")} />
                <Select
                    label="Calcul"
                    required
                    error={errors.calculation?.message}
                    {...register("calculation", { onChange: (event) => onCalculationChange(event.target.value) })}
                >
                    {(Object.keys(CALCULATION_LABELS) as PayItemCalculation[]).map((value) => (
                        <option key={value} value={value}>
                            {CALCULATION_LABELS[value]}
                        </option>
                    ))}
                </Select>
                <Select label="Catégorie" required disabled={system} error={errors.category?.message} {...register("category")}>
                    {categories.map((category) => (
                        <option key={category} value={category}>
                            {CATEGORY_LABELS[category]}
                        </option>
                    ))}
                </Select>
            </div>

            {system ? (
                <Alert tone="info">
                    Élément calculé par le moteur à partir du contrat, des présences et des congés : il n'a ni montant, ni taux, ni
                    application automatique. Il doit exister (et être actif) pour calculer un bulletin.
                </Alert>
            ) : (
                <>
                    {percent ? (
                        <Input
                            label="Taux par défaut (%)"
                            inputMode="decimal"
                            hint={calculation === "PERCENT_OF_GROSS" ? "Sur le brut : réservé aux cotisations, impôts et retenues." : "Sur le salaire de base."}
                            error={errors.default_rate?.message}
                            {...register("default_rate")}
                        />
                    ) : (
                        <Input label="Montant par défaut" inputMode="decimal" error={errors.default_amount?.message} {...register("default_amount")} />
                    )}
                    <Checkbox
                        label="Appliqué automatiquement à tous les employés"
                        hint="Exige un montant ou un taux par défaut. Sinon l'élément s'attribue par employé."
                        {...register("applies_to_all")}
                    />
                </>
            )}
            <Checkbox label="Type actif" hint="Un type inactif n'est plus utilisé dans les calculs." {...register("is_active")} />
        </ModalForm>
    );
}

export function PayItemTypeFormModal({ open, ...body }: BodyProps & { open: boolean }) {
    return (
        <Modal open={open} onClose={body.onClose} title={body.payItemType ? "Modifier le type d'élément" : "Nouveau type d'élément de paie"} size="lg" padded={false}>
            <PayItemTypeFormBody {...body} />
        </Modal>
    );
}