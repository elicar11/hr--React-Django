import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Checkbox, Input, Modal, ModalForm } from "@/components/ui";
import { applyApiErrors } from "@/lib/forms";
import { notify } from "@/lib/notify";
import { createSchedule, updateSchedule } from "../services/scheduleService";
import type { WorkSchedule } from "../types";
import { WEEKDAYS } from "../weekdays";

const minutes = z.string().refine((value) => /^\d{1,3}$/.test(value), "Nombre de minutes (0 à 240).");

const schema = z
    .object({
        code: z.string().trim().min(1, "Le code est obligatoire.").max(20, "20 caractères maximum."),
        name: z.string().trim().min(1, "Le nom est obligatoire.").max(150, "150 caractères maximum."),
        start_time: z.string().min(1, "L'heure de début est obligatoire."),
        end_time: z.string().min(1, "L'heure de fin est obligatoire."),
        break_start: z.string(),
        break_end: z.string(),
        working_days: z.array(z.number()).min(1, "Choisissez au moins un jour travaillé."),
        late_grace_minutes: minutes,
        overtime_threshold_minutes: minutes,
    })
    .refine((values) => (values.break_start === "") === (values.break_end === ""), {
        path: ["break_end"],
        message: "Renseignez le début et la fin de la pause, ou aucun des deux.",
    });
type FormValues = z.infer<typeof schema>;

const FIELDS = [
    "code", "name", "start_time", "end_time", "break_start", "break_end", "working_days",
    "late_grace_minutes", "overtime_threshold_minutes",
] as const;

interface BodyProps {
    schedule: WorkSchedule | null;
    onClose: () => void;
    onSaved: () => void;
}

function ScheduleFormBody({ schedule, onClose, onSaved }: BodyProps) {
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
            code: schedule?.code ?? "",
            name: schedule?.name ?? "",
            start_time: schedule?.start_time.slice(0, 5) ?? "08:00",
            end_time: schedule?.end_time.slice(0, 5) ?? "17:00",
            break_start: schedule?.break_start?.slice(0, 5) ?? "",
            break_end: schedule?.break_end?.slice(0, 5) ?? "",
            working_days: schedule?.working_days ?? [0, 1, 2, 3, 4],
            late_grace_minutes: String(schedule?.late_grace_minutes ?? 0),
            overtime_threshold_minutes: String(schedule?.overtime_threshold_minutes ?? 0),
        },
    });

    async function onSubmit(values: FormValues) {
        setMessages([]);
        const input = {
            code: values.code.toUpperCase(),
            name: values.name,
            start_time: values.start_time,
            end_time: values.end_time,
            break_start: values.break_start || null,
            break_end: values.break_end || null,
            working_days: values.working_days,
            late_grace_minutes: Number(values.late_grace_minutes),
            overtime_threshold_minutes: Number(values.overtime_threshold_minutes),
        };
        try {
            if (schedule) await updateSchedule(schedule.id, input);
            else await createSchedule(input);
            notify.success(schedule ? "Horaire modifié" : "Horaire créé");
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
            {schedule && (
                <Alert tone="info">
                    Les modifications ne s'appliquent qu'aux calculs à venir : les retards et heures supplémentaires déjà
                    enregistrés ne changent pas.
                </Alert>
            )}
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
                <Input label="Début" type="time" required error={errors.start_time?.message} {...register("start_time")} />
                <Input label="Fin" type="time" required error={errors.end_time?.message} {...register("end_time")} />
                <Input label="Début de pause" type="time" hint="Facultatif." error={errors.break_start?.message} {...register("break_start")} />
                <Input label="Fin de pause" type="time" error={errors.break_end?.message} {...register("break_end")} />
                <Input
                    label="Tolérance de retard (min)"
                    inputMode="numeric"
                    hint="Pas de retard si l'arrivée est dans ce délai."
                    error={errors.late_grace_minutes?.message}
                    {...register("late_grace_minutes")}
                />
                <Input
                    label="Seuil des heures sup (min)"
                    inputMode="numeric"
                    hint="Minutes après l'heure de fin avant de compter des heures sup."
                    error={errors.overtime_threshold_minutes?.message}
                    {...register("overtime_threshold_minutes")}
                />
            </div>

            <Controller
                control={control}
                name="working_days"
                render={({ field }) => (
                    <fieldset className="space-y-2">
                        <legend className="text-sm font-bold uppercase tracking-wide">
                            Jours travaillés<span aria-hidden="true"> *</span>
                        </legend>
                        <div className="flex flex-wrap gap-x-5 gap-y-2">
                            {WEEKDAYS.map((day) => (
                                <Checkbox
                                    key={day.id}
                                    label={day.long}
                                    checked={field.value.includes(day.id)}
                                    onChange={(event) =>
                                        field.onChange(
                                            event.target.checked
                                                ? [...field.value, day.id].sort((a, b) => a - b)
                                                : field.value.filter((value) => value !== day.id),
                                        )
                                    }
                                />
                            ))}
                        </div>
                        {errors.working_days?.message && (
                            <p role="alert" className="flex items-start gap-1.5 text-sm font-bold text-danger">
                                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                                {errors.working_days.message}
                            </p>
                        )}
                    </fieldset>
                )}
            />
        </ModalForm>
    );
}

export function ScheduleFormModal({ open, ...body }: BodyProps & { open: boolean }) {
    return (
        <Modal open={open} onClose={body.onClose} title={body.schedule ? "Modifier l'horaire" : "Nouvel horaire de travail"} size="lg" padded={false}>
            <ScheduleFormBody {...body} />
        </Modal>
    );
}