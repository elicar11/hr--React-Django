import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, DateField, Input, Modal, ModalForm, Select, Textarea } from "@/components/ui";
import { formatDecimal, todayISO } from "@/lib/format";
import { applyApiErrors } from "@/lib/forms";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { notify } from "@/lib/notify";
import { EmployeePicker, type PickedEmployee } from "@/modules/employees/components/EmployeePicker";
import { createLeaveRequest, getAllLeaveTypes, updateLeaveRequest } from "../services/leaveService";
import type { LeaveRequest } from "../types";

const schema = z
    .object({
        leave_type: z.string().min(1, "Choisissez un type de congé."),
        start_date: z.string().min(1, "La date de début est obligatoire."),
        end_date: z.string().min(1, "La date de fin est obligatoire."),
        reason: z.string().max(500, "500 caractères maximum."),
    })
    .refine((values) => values.end_date >= values.start_date, {
        path: ["end_date"],
        message: "La fin doit être postérieure ou égale au début.",
    });
type FormValues = z.infer<typeof schema>;

interface BodyProps {
    /** null = new request. */
    leave: LeaveRequest | null;
    /** ADMIN / HR create on behalf of an employee. */
    asHr: boolean;
    onClose: () => void;
    onSaved: (leave: LeaveRequest) => void;
}

function LeaveRequestBody({ leave, asHr, onClose, onSaved }: BodyProps) {
    const creating = leave === null;
    const [employee, setEmployee] = useState<PickedEmployee | null>(null);
    const [employeeError, setEmployeeError] = useState<string>();
    const [messages, setMessages] = useState<string[]>([]);
    const types = useApiQuery(["leave-types-active"], (signal) => getAllLeaveTypes(signal, true));
    const {
        register,
        handleSubmit,
        setError,
        watch,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            leave_type: leave ? String(leave.leave_type) : "",
            start_date: leave?.start_date ?? "",
            end_date: leave?.end_date ?? "",
            reason: leave?.reason ?? "",
        },
    });
    const startDate = watch("start_date");

    async function onSubmit(values: FormValues) {
        setMessages([]);
        if (creating && asHr && !employee) return setEmployeeError("Choisissez l'employé concerné.");
        const input = {
            leave_type: Number(values.leave_type),
            start_date: values.start_date,
            end_date: values.end_date,
            reason: values.reason.trim(),
        };
        try {
            const saved = creating
                ? await createLeaveRequest({ ...input, ...(asHr && employee ? { employee: employee.id } : {}) })
                : await updateLeaveRequest(leave.id, input);
            notify.success(
                creating ? "Demande envoyée" : "Demande modifiée",
                `${formatDecimal(saved.days)} jour(s) décompté(s) par le serveur.`,
            );
            onSaved(saved);
            onClose();
        } catch (error) {
            setMessages(applyApiErrors(error, setError, ["leave_type", "start_date", "end_date", "reason"]));
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
                        {creating ? "Envoyer la demande" : "Enregistrer"}
                    </Button>
                </>
            }
        >
            <Alert tone="info">
                Le nombre de jours est <strong>calculé par le serveur</strong> (jours travaillés selon l'horaire de l'employé,
                jours fériés exclus) et le solde est vérifié. Une demande qui chevauche une autre est refusée.
            </Alert>
            {messages.length > 0 && (
                <Alert tone="error">
                    {messages.map((message) => (
                        <p key={message}>{message}</p>
                    ))}
                </Alert>
            )}
            {creating && asHr && (
                <EmployeePicker
                    required
                    value={employee}
                    onChange={(picked) => {
                        setEmployee(picked);
                        setEmployeeError(undefined);
                    }}
                    error={employeeError}
                />
            )}
            {!creating && <Input label="Employé" value={leave.employee_name} disabled readOnly />}
            <Select label="Type de congé" required placeholder="Choisir…" error={errors.leave_type?.message} {...register("leave_type")}>
                {(types.data ?? []).map((type) => (
                    <option key={type.id} value={type.id}>
                        {type.code} · {type.name}
                    </option>
                ))}
            </Select>
            <div className="grid gap-4 sm:grid-cols-2">
                <DateField label="Du" required min={creating ? todayISO() : undefined} error={errors.start_date?.message} {...register("start_date")} />
                <DateField label="Au" required min={startDate || undefined} error={errors.end_date?.message} {...register("end_date")} />
            </div>
            <Textarea
                label="Motif"
                rows={3}
                hint="Facultatif. Ne saisissez aucune donnée médicale."
                error={errors.reason?.message}
                {...register("reason")}
            />
        </ModalForm>
    );
}

export function LeaveRequestModal({ open, ...body }: BodyProps & { open: boolean }) {
    return (
        <Modal open={open} onClose={body.onClose} title={body.leave ? "Modifier la demande" : "Nouvelle demande de congé"} padded={false}>
            <LeaveRequestBody {...body} />
        </Modal>
    );
}