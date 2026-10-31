import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, DateField, Input, Modal, ModalForm, Select, Textarea } from "@/components/ui";
import { isoToLocalInput, localDateTimeToISO, todayISO } from "@/lib/format";
import { applyApiErrors } from "@/lib/forms";
import { notify } from "@/lib/notify";
import { EmployeePicker, type PickedEmployee } from "@/modules/employees/components/EmployeePicker";
import { createAttendanceRecord, updateAttendanceRecord } from "../services/attendanceService";
import type { AttendanceRecord } from "../types";

const schema = z.object({
    date: z.string().min(1, "La date est obligatoire."),
    status: z.enum(["PRESENT", "ABSENT_JUSTIFIED", "ABSENT_UNJUSTIFIED"]),
    check_in: z.string(),
    check_out: z.string(),
    absence_reason: z.string().max(255, "255 caractères maximum."),
});
type FormValues = z.infer<typeof schema>;

interface BodyProps {
    /** null = new record. */
    record: AttendanceRecord | null;
    onClose: () => void;
    onSaved: () => void;
}

function RecordFormBody({ record, onClose, onSaved }: BodyProps) {
    const creating = record === null;
    const [employee, setEmployee] = useState<PickedEmployee | null>(null);
    const [employeeError, setEmployeeError] = useState<string>();
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
            date: record?.date ?? todayISO(),
            status: record?.status ?? "PRESENT",
            check_in: isoToLocalInput(record?.check_in ?? null),
            check_out: isoToLocalInput(record?.check_out ?? null),
            absence_reason: record?.absence_reason ?? "",
        },
    });
    const status = useWatch({ control, name: "status" });
    const present = status === "PRESENT";

    async function onSubmit(values: FormValues) {
        setMessages([]);
        if (creating && !employee) return setEmployeeError("Choisissez un employé.");
        if (present && !values.check_in) return setError("check_in", { message: "L'entrée est obligatoire pour une présence." });
        if (status === "ABSENT_JUSTIFIED" && !values.absence_reason.trim()) {
            return setError("absence_reason", { message: "Un motif est obligatoire pour une absence justifiée." });
        }

        // Local date-times are sent with their time zone; the API applies its own rules.
        const times = {
            check_in: present ? localDateTimeToISO(values.check_in) : null,
            check_out: present && values.check_out ? localDateTimeToISO(values.check_out) : null,
        };
        const reason = present ? "" : values.absence_reason.trim();
        try {
            if (creating) {
                await createAttendanceRecord({ employee: employee!.id, date: values.date, status, ...times, absence_reason: reason });
            } else {
                await updateAttendanceRecord(record.id, { status, ...times, absence_reason: reason });
            }
            notify.success(creating ? "Enregistrement créé" : "Enregistrement modifié");
            onSaved();
            onClose();
        } catch (error) {
            setMessages(applyApiErrors(error, setError, ["date", "status", "check_in", "check_out", "absence_reason"]));
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
                <EmployeePicker
                    required
                    excludeTerminated={false}
                    value={employee}
                    onChange={(picked) => {
                        setEmployee(picked);
                        setEmployeeError(undefined);
                    }}
                    error={employeeError}
                />
            ) : (
                <Input label="Employé" value={record.employee_name} disabled readOnly />
            )}
            <div className="grid gap-4 sm:grid-cols-2">
                <DateField label="Jour" required max={todayISO()} disabled={!creating} error={errors.date?.message} {...register("date")} />
                <Select label="Statut" required error={errors.status?.message} {...register("status")}>
                    <option value="PRESENT">Présent</option>
                    <option value="ABSENT_JUSTIFIED">Absence justifiée</option>
                    <option value="ABSENT_UNJUSTIFIED">Absence injustifiée</option>
                </Select>
            </div>
            {present ? (
                <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Entrée" type="datetime-local" required error={errors.check_in?.message} {...register("check_in")} />
                    <Input
                        label="Sortie"
                        type="datetime-local"
                        hint="Laissez vide si la journée n'est pas terminée."
                        error={errors.check_out?.message}
                        {...register("check_out")}
                    />
                </div>
            ) : (
                <Textarea
                    label="Motif"
                    required={status === "ABSENT_JUSTIFIED"}
                    rows={3}
                    hint="Ne saisissez aucune donnée médicale."
                    error={errors.absence_reason?.message}
                    {...register("absence_reason")}
                />
            )}
            <p className="text-sm text-gray-dark">
                Retards, heures travaillées et heures supplémentaires sont calculés par le serveur selon l'horaire de l'employé.
            </p>
        </ModalForm>
    );
}

export function RecordFormModal({ open, ...body }: BodyProps & { open: boolean }) {
    return (
        <Modal open={open} onClose={body.onClose} title={body.record ? "Corriger l'enregistrement" : "Saisir une présence ou une absence"} padded={false}>
            <RecordFormBody {...body} />
        </Modal>
    );
}