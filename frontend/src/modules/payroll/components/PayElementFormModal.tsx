import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, DateField, Input, Modal, ModalForm, Select } from "@/components/ui";
import { DECIMAL_PATTERN, RATE_PATTERN, toDecimalString } from "@/lib/decimal";
import { todayISO } from "@/lib/format";
import { applyApiErrors } from "@/lib/forms";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { notify } from "@/lib/notify";
import { EmployeePicker, type PickedEmployee } from "@/modules/employees/components/EmployeePicker";
import { CALCULATION_LABELS } from "../payrollLabels";
import { createPayElement, getAllPayItemTypes } from "../services/payrollService";

const schema = z.object({
    item_type: z.string().min(1, "Choisissez un type d'élément."),
    value: z.string().trim().min(1, "La valeur est obligatoire."),
    start_date: z.string().min(1, "La date de début est obligatoire."),
    end_date: z.string(),
});
type FormValues = z.infer<typeof schema>;

interface BodyProps {
    /** Preselected employee (from the employee sheet). */
    initialEmployee?: PickedEmployee | null;
    onClose: () => void;
    onSaved: () => void;
}

function PayElementBody({ initialEmployee = null, onClose, onSaved }: BodyProps) {
    const [employee, setEmployee] = useState<PickedEmployee | null>(initialEmployee);
    const [employeeError, setEmployeeError] = useState<string>();
    const [messages, setMessages] = useState<string[]>([]);
    const types = useApiQuery(["pay-item-types-active"], (signal) => getAllPayItemTypes(signal, true));
    // Applied-to-all and engine-computed types cannot be given to a single employee.
    const options = (types.data ?? []).filter(
        (type) => !type.applies_to_all && (type.calculation === "FIXED" || type.calculation === "PERCENT_OF_BASE" || type.calculation === "PERCENT_OF_GROSS"),
    );
    const {
        register,
        handleSubmit,
        control,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { item_type: "", value: "", start_date: todayISO(), end_date: "" },
    });
    const selectedType = useWatch({ control, name: "item_type" });
    const chosen = options.find((type) => String(type.id) === selectedType);
    const isRate = chosen ? chosen.calculation !== "FIXED" : false;

    async function onSubmit(values: FormValues) {
        setMessages([]);
        if (!employee) return setEmployeeError("Choisissez un employé.");
        const pattern = isRate ? RATE_PATTERN : DECIMAL_PATTERN;
        if (!pattern.test(values.value)) {
            return setError("value", { message: isRate ? "Taux invalide (jusqu'à 4 décimales)." : "Montant invalide (ex. 50 ou 50,25)." });
        }
        const value = toDecimalString(values.value);
        try {
            await createPayElement({
                employee: employee.id,
                item_type: Number(values.item_type),
                amount: isRate ? null : value,
                rate: isRate ? value : null,
                start_date: values.start_date,
                end_date: values.end_date || null,
            });
            notify.success("Élément ajouté");
            onSaved();
            onClose();
        } catch (error) {
            setMessages(applyApiErrors(error, setError, ["item_type", "value", "start_date", "end_date"]));
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
                        Ajouter l'élément
                    </Button>
                </>
            }
        >
            <Alert tone="info">
                Un élément n'est pas modifiable : pour changer sa valeur, terminez-le puis créez-en un nouveau. L'historique est conservé.
            </Alert>
            {messages.length > 0 && (
                <Alert tone="error">
                    {messages.map((message) => (
                        <p key={message}>{message}</p>
                    ))}
                </Alert>
            )}
            <EmployeePicker
                required
                value={employee}
                onChange={(picked) => {
                    setEmployee(picked);
                    setEmployeeError(undefined);
                }}
                error={employeeError}
            />
            <Select label="Type d'élément" required placeholder="Choisir…" error={errors.item_type?.message} {...register("item_type")}>
                {options.map((type) => (
                    <option key={type.id} value={type.id}>
                        {type.code} · {type.name} ({CALCULATION_LABELS[type.calculation]})
                    </option>
                ))}
            </Select>
            <Input
                label={isRate ? "Taux (%)" : "Montant"}
                required
                inputMode="decimal"
                hint={chosen ? undefined : "Choisissez d'abord un type d'élément."}
                error={errors.value?.message}
                {...register("value")}
            />
            <div className="grid gap-4 sm:grid-cols-2">
                <DateField label="Début" required error={errors.start_date?.message} {...register("start_date")} />
                <DateField label="Fin" hint="Facultative." error={errors.end_date?.message} {...register("end_date")} />
            </div>
        </ModalForm>
    );
}

export function PayElementFormModal({ open, ...body }: BodyProps & { open: boolean }) {
    return (
        <Modal open={open} onClose={body.onClose} title="Nouvel élément de rémunération" padded={false}>
            <PayElementBody {...body} />
        </Modal>
    );
}