import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, DateField, Modal, ModalForm, Select } from "@/components/ui";
import { todayISO } from "@/lib/format";
import { applyApiErrors } from "@/lib/forms";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { notify } from "@/lib/notify";
import { EmployeePicker, type PickedEmployee } from "@/modules/employees/components/EmployeePicker";
import { createAssignment, getAllSchedules } from "../services/scheduleService";

const schema = z.object({
    schedule: z.string().min(1, "Choisissez un horaire."),
    start_date: z.string().min(1, "La date d'effet est obligatoire."),
});
type FormValues = z.infer<typeof schema>;

interface BodyProps {
    onClose: () => void;
    onSaved: () => void;
}

function AssignBody({ onClose, onSaved }: BodyProps) {
    const [employee, setEmployee] = useState<PickedEmployee | null>(null);
    const [employeeError, setEmployeeError] = useState<string>();
    const [messages, setMessages] = useState<string[]>([]);
    const schedules = useApiQuery(["schedules-all"], (signal) => getAllSchedules(signal));
    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { schedule: "", start_date: todayISO() } });

    async function onSubmit(values: FormValues) {
        setMessages([]);
        if (!employee) return setEmployeeError("Choisissez un employé.");
        try {
            await createAssignment({ employee: employee.id, schedule: Number(values.schedule), start_date: values.start_date });
            notify.success("Horaire affecté");
            onSaved();
            onClose();
        } catch (error) {
            setMessages(applyApiErrors(error, setError, ["schedule", "start_date"]));
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
                        Affecter
                    </Button>
                </>
            }
        >
            <Alert tone="info">
                L'affectation précédente de l'employé prend fin la veille de la date d'effet. Sans affectation, c'est l'horaire par défaut qui s'applique.
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
            <Select label="Horaire" required placeholder="Choisir…" error={errors.schedule?.message} {...register("schedule")}>
                {(schedules.data ?? []).map((schedule) => (
                    <option key={schedule.id} value={schedule.id}>
                        {schedule.code} · {schedule.name}
                    </option>
                ))}
            </Select>
            <DateField label="Date d'effet" required error={errors.start_date?.message} {...register("start_date")} />
        </ModalForm>
    );
}

export function AssignScheduleModal({ open, ...body }: BodyProps & { open: boolean }) {
    return (
        <Modal open={open} onClose={body.onClose} title="Affecter un horaire" padded={false}>
            <AssignBody {...body} />
        </Modal>
    );
}