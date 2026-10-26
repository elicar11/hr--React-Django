import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Input, Modal, ModalForm, Select, Textarea } from "@/components/ui";
import { applyApiErrors } from "@/lib/forms";
import { notify } from "@/lib/notify";
import { createPosition, flattenDepartments, updatePosition } from "../services/organizationService";
import type { DepartmentNode, Position } from "../types";

const schema = z.object({
    code: z.string().trim().min(1, "Le code est obligatoire.").max(20, "20 caractères maximum."),
    title: z.string().trim().min(1, "L'intitulé est obligatoire.").max(150, "150 caractères maximum."),
    description: z.string(),
    level: z.string().min(1, "Choisissez un niveau."),
    department: z.string(),
});
type FormValues = z.infer<typeof schema>;

export const LEVELS = Array.from({ length: 10 }, (_, index) => index + 1);

export function levelLabel(level: number): string {
    if (level === 1) return "1 · Direction";
    if (level === 10) return "10 · Opérationnel";
    return String(level);
}

interface BodyProps {
    position: Position | null;
    tree: DepartmentNode[];
    onClose: () => void;
    onSaved: () => void;
}

function PositionFormBody({ position, tree, onClose, onSaved }: BodyProps) {
    const [messages, setMessages] = useState<string[]>([]);
    const departmentOptions = flattenDepartments(tree);
    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            code: position?.code ?? "",
            title: position?.title ?? "",
            description: position?.description ?? "",
            level: String(position?.level ?? 5),
            department: position?.department ? String(position.department) : "",
        },
    });

    async function onSubmit(values: FormValues) {
        setMessages([]);
        const input = {
            code: values.code.toUpperCase(),
            title: values.title,
            description: values.description,
            level: Number(values.level),
            department: values.department ? Number(values.department) : null,
        };
        try {
            if (position) await updatePosition(position.id, input);
            else await createPosition(input);
            notify.success(position ? "Poste modifié" : "Poste créé");
            onSaved();
            onClose();
        } catch (error) {
            setMessages(applyApiErrors(error, setError, ["code", "title", "description", "level", "department"]));
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
                    hint="Unique, en majuscules (ex. DRH)."
                    className="uppercase"
                    autoFocus
                    error={errors.code?.message}
                    {...register("code")}
                />
                <Input label="Intitulé" required error={errors.title?.message} {...register("title")} />
                <Select label="Niveau hiérarchique" required error={errors.level?.message} {...register("level")}>
                    {LEVELS.map((level) => (
                        <option key={level} value={level}>
                            {levelLabel(level)}
                        </option>
                    ))}
                </Select>
                <Select
                    label="Département"
                    placeholder="Aucun (poste transversal)"
                    hint="Un poste rattaché à un département n'est attribuable qu'à ses employés."
                    error={errors.department?.message}
                    {...register("department")}
                >
                    {departmentOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                            {option.label}
                        </option>
                    ))}
                </Select>
            </div>
            <Textarea label="Description" error={errors.description?.message} {...register("description")} />
        </ModalForm>
    );
}

export function PositionFormModal({ open, ...body }: BodyProps & { open: boolean }) {
    return (
        <Modal open={open} onClose={body.onClose} title={body.position ? "Modifier le poste" : "Nouveau poste"} padded={false}>
            <PositionFormBody {...body} />
        </Modal>
    );
}