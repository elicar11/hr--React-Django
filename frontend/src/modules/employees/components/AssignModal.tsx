import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, DateField, Modal, ModalForm, Select } from "@/components/ui";
import { todayISO } from "@/lib/format";
import { applyApiErrors } from "@/lib/forms";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { notify } from "@/lib/notify";
import {
    flattenDepartments,
    getAllPositions,
    getDepartmentTree,
} from "@/modules/organization/services/organizationService";
import { assignEmployee } from "../services/employeeService";
import type { Employee } from "../types";

const schema = z.object({
    department: z.string().min(1, "Choisissez un département."),
    position: z.string().min(1, "Choisissez un poste."),
    start_date: z.string().min(1, "La date d'effet est obligatoire."),
});
type FormValues = z.infer<typeof schema>;

interface BodyProps {
    employee: Employee;
    onClose: () => void;
    onSaved: () => void;
}

function AssignBody({ employee, onClose, onSaved }: BodyProps) {
    const [messages, setMessages] = useState<string[]>([]);
    const tree = useApiQuery(["departments-tree"], (signal) => getDepartmentTree(signal));
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
        defaultValues: { department: String(employee.department), position: "", start_date: todayISO() },
    });
    const department = useWatch({ control, name: "department" });

    // A position attached to a department can only go to that department's employees.
    const positionOptions = (positions.data ?? []).filter(
        (position) => position.department === null || String(position.department) === department,
    );

    async function onSubmit(values: FormValues) {
        setMessages([]);
        try {
            await assignEmployee(employee.id, {
                department: Number(values.department),
                position: Number(values.position),
                start_date: values.start_date,
            });
            notify.success("Affectation enregistrée");
            onSaved();
            onClose();
        } catch (error) {
            setMessages(applyApiErrors(error, setError, ["department", "position", "start_date"]));
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
            <p className="text-sm text-gray-dark">
                Affectation actuelle : <strong>{employee.department_name}</strong>, {employee.position_title}. L'ancienne
                affectation est conservée dans l'historique et se termine la veille de la date d'effet.
            </p>
            <Select
                label="Département"
                required
                error={errors.department?.message}
                {...register("department", { onChange: () => setValue("position", "") })}
            >
                {flattenDepartments(tree.data ?? []).map((option) => (
                    <option key={option.id} value={option.id}>
                        {option.label}
                    </option>
                ))}
            </Select>
            <Select label="Poste" required placeholder="Choisir…" error={errors.position?.message} {...register("position")}>
                {positionOptions.map((position) => (
                    <option key={position.id} value={position.id}>
                        {position.code} · {position.title}
                    </option>
                ))}
            </Select>
            <DateField label="Date d'effet" required error={errors.start_date?.message} {...register("start_date")} />
        </ModalForm>
    );
}

export function AssignModal({ open, ...body }: BodyProps & { open: boolean }) {
    return (
        <Modal open={open} onClose={body.onClose} title="Changer d'affectation" padded={false}>
            <AssignBody {...body} />
        </Modal>
    );
}