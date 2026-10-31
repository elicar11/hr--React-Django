import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Input, Modal, ModalForm, Select } from "@/components/ui";
import { DECIMAL_PATTERN, toDecimalString } from "@/lib/decimal";
import { formatDecimal } from "@/lib/format";
import { applyApiErrors } from "@/lib/forms";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { notify } from "@/lib/notify";
import { EmployeePicker, type PickedEmployee } from "@/modules/employees/components/EmployeePicker";
import { createBalance, getAllLeaveTypes, updateBalance } from "../services/leaveService";
import type { LeaveBalance } from "../types";

const schema = z.object({
    leave_type: z.string(),
    year: z.string(),
    allocated: z.string().refine((value) => DECIMAL_PATTERN.test(value.trim()), "Nombre de jours invalide (ex. 25 ou 2,5)."),
});
type FormValues = z.infer<typeof schema>;

interface BodyProps {
    /** null = new balance. Editing only changes the allocation. */
    balance: LeaveBalance | null;
    onClose: () => void;
    onSaved: () => void;
}

function BalanceBody({ balance, onClose, onSaved }: BodyProps) {
    const creating = balance === null;
    const [employee, setEmployee] = useState<PickedEmployee | null>(null);
    const [employeeError, setEmployeeError] = useState<string>();
    const [messages, setMessages] = useState<string[]>([]);
    const types = useApiQuery(["leave-types-active"], (signal) => getAllLeaveTypes(signal, true));
    const currentYear = new Date().getFullYear();
    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            leave_type: "",
            year: String(currentYear),
            allocated: balance?.allocated ?? "",
        },
    });

    async function onSubmit(values: FormValues) {
        setMessages([]);
        const allocated = toDecimalString(values.allocated);
        try {
            if (creating) {
                if (!employee) return setEmployeeError("Choisissez un employé.");
                if (!values.leave_type) return setError("leave_type", { message: "Choisissez un type de congé." });
                await createBalance({ employee: employee.id, leave_type: Number(values.leave_type), year: Number(values.year), allocated });
            } else {
                await updateBalance(balance.id, allocated);
            }
            notify.success(creating ? "Solde créé" : "Allocation modifiée");
            onSaved();
            onClose();
        } catch (error) {
            setMessages(applyApiErrors(error, setError, ["leave_type", "year", "allocated"]));
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
            {creating ? (
                <>
                    <EmployeePicker
                        required
                        value={employee}
                        onChange={(picked) => {
                            setEmployee(picked);
                            setEmployeeError(undefined);
                        }}
                        error={employeeError}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Select label="Type de congé" required placeholder="Choisir…" error={errors.leave_type?.message} {...register("leave_type")}>
                            {(types.data ?? [])
                                .filter((type) => type.uses_balance)
                                .map((type) => (
                                    <option key={type.id} value={type.id}>
                                        {type.code} · {type.name}
                                    </option>
                                ))}
                        </Select>
                        <Select label="Année" required error={errors.year?.message} {...register("year")}>
                            {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
                                <option key={year} value={year}>
                                    {year}
                                </option>
                            ))}
                        </Select>
                    </div>
                </>
            ) : (
                <Alert tone="info">
                    {balance.employee_name} · {balance.leave_type_name} · {balance.year} : {formatDecimal(balance.used)} jour(s) déjà utilisé(s).
                    L'allocation ne peut pas être inférieure.
                </Alert>
            )}
            <Input
                label="Jours alloués"
                required
                inputMode="decimal"
                hint="Selon la politique de l'entreprise : aucune valeur n'est supposée."
                error={errors.allocated?.message}
                {...register("allocated")}
            />
        </ModalForm>
    );
}

export function BalanceFormModal({ open, ...body }: BodyProps & { open: boolean }) {
    return (
        <Modal open={open} onClose={body.onClose} title={body.balance ? "Modifier l'allocation" : "Nouveau solde de congé"} padded={false}>
            <BalanceBody {...body} />
        </Modal>
    );
}