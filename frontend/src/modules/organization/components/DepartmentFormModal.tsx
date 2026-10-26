import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Input, Modal, ModalForm, Select, Textarea } from "@/components/ui";
import { applyApiErrors } from "@/lib/forms";
import { notify } from "@/lib/notify";
import { createDepartment, flattenDepartments, updateDepartment } from "../services/organizationService";
import type { Department, DepartmentNode } from "../types";

const schema = z.object({
    code: z.string().trim().min(1, "Le code est obligatoire.").max(20, "20 caractères maximum."),
    name: z.string().trim().min(1, "Le nom est obligatoire.").max(150, "150 caractères maximum."),
    description: z.string(),
    parent: z.string(),
});
type FormValues = z.infer<typeof schema>;

interface BodyProps {
    department: Department | null;
    tree: DepartmentNode[];
    onClose: () => void;
    onSaved: () => void;
}

function DepartmentFormBody({ department, tree, onClose, onSaved }: BodyProps) {
    const [messages, setMessages] = useState<string[]>([]);
    // A department cannot be attached to itself or to one of its own sub-departments.
    const parentOptions = flattenDepartments(tree, department ? new Set([department.id]) : undefined);
    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            code: department?.code ?? "",
            name: department?.name ?? "",
            description: department?.description ?? "",
            parent: department?.parent ? String(department.parent) : "",
        },
    });

    async function onSubmit(values: FormValues) {
        setMessages([]);
        const input = {
            code: values.code.toUpperCase(),
            name: values.name,
            description: values.description,
            parent: values.parent ? Number(values.parent) : null,
        };
        try {
            if (department) await updateDepartment(department.id, input);
            else await createDepartment(input);
            notify.success(department ? "Département modifié" : "Département créé");
            onSaved();
            onClose();
        } catch (error) {
            setMessages(applyApiErrors(error, setError, ["code", "name", "description", "parent"]));
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
                <Input
                    label="Code"
                    required
                    hint="Unique, en majuscules (ex. RH, DEV-01)."
                    className="uppercase"
                    autoFocus
                    error={errors.code?.message}
                    {...register("code")}
                />
                <Input label="Nom" required error={errors.name?.message} {...register("name")} />
            </div>
            <Select
                label="Rattaché à"
                placeholder="Aucun (département racine)"
                hint="Seuls les départements actifs sont proposés."
                error={errors.parent?.message}
                {...register("parent")}
            >
                {parentOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                        {option.label}
                    </option>
                ))}
            </Select>
            <Textarea label="Description" error={errors.description?.message} {...register("description")} />
        </ModalForm>
    );
}

export function DepartmentFormModal({ open, ...body }: BodyProps & { open: boolean }) {
    return (
        <Modal
            open={open}
            onClose={body.onClose}
            title={body.department ? "Modifier le département" : "Nouveau département"}
            padded={false}
        >
            <DepartmentFormBody {...body} />
        </Modal>
    );
}