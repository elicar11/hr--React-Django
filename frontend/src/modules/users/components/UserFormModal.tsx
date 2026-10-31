import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Input, Modal, ModalForm, PasswordField, Select } from "@/components/ui";
import { applyApiErrors } from "@/lib/forms";
import { notify } from "@/lib/notify";
import { generatePassword } from "@/lib/password";
import { ROLE_LABELS, type Role, type User } from "@/modules/auth/types";
import { EmployeePicker, type PickedEmployee } from "@/modules/employees/components/EmployeePicker";
import { updateEmployee } from "@/modules/employees/services/employeeService";
import { createUser, updateUser } from "../services/userService";

const schema = z.object({
    first_name: z.string().trim().min(1, "Le prénom est obligatoire.").max(150, "150 caractères maximum."),
    last_name: z.string().trim().min(1, "Le nom est obligatoire.").max(150, "150 caractères maximum."),
    email: z.email("Adresse e-mail invalide."),
    role: z.enum(["ADMIN", "HR", "EMPLOYEE"]),
    password: z.string(),
});
type FormValues = z.infer<typeof schema>;

const ROLE_HINTS: Record<Role, string> = {
    ADMIN: "Accès total : comptes, paramètres, journal d'audit.",
    HR: "Gestion du personnel, des contrats, des congés, des présences et de la paie.",
    EMPLOYEE: "Accès à son propre dossier, ses pointages, ses congés et ses bulletins.",
};

interface BodyProps {
    /** null = new account. */
    user: User | null;
    currentUserId: number;
    onClose: () => void;
    onSaved: () => void;
}

function UserFormBody({ user, currentUserId, onClose, onSaved }: BodyProps) {
    const creating = user === null;
    const isSelf = user?.id === currentUserId;
    const [employee, setEmployee] = useState<PickedEmployee | null>(null);
    const [generated, setGenerated] = useState<string | null>(null);
    const [messages, setMessages] = useState<string[]>([]);
    const {
        register,
        handleSubmit,
        setValue,
        watch,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            first_name: user?.first_name ?? "",
            last_name: user?.last_name ?? "",
            email: user?.email ?? "",
            role: user?.role ?? "EMPLOYEE",
            password: "",
        },
    });
    const role = watch("role");

    function suggestPassword() {
        const password = generatePassword();
        setValue("password", password, { shouldValidate: true });
        setGenerated(password);
    }

    async function copyPassword() {
        if (!generated) return;
        try {
            await navigator.clipboard.writeText(generated);
            notify.success("Mot de passe copié");
        } catch {
            notify.info("Copie impossible", "Sélectionnez le mot de passe et copiez-le à la main.");
        }
    }

    async function onSubmit(values: FormValues) {
        setMessages([]);
        const email = values.email.trim().toLowerCase();
        try {
            if (creating) {
                if (!values.password) return setError("password", { message: "Le mot de passe initial est obligatoire." });
                const created = await createUser({
                    email,
                    first_name: values.first_name,
                    last_name: values.last_name,
                    role: values.role,
                    password: values.password,
                });
                if (employee) {
                    try {
                        await updateEmployee(employee.id, { user: created.id });
                    } catch (error) {
                        notify.error(error, "Compte créé, mais le lien avec l'employé a échoué");
                        onSaved();
                        onClose();
                        return;
                    }
                }
                notify.success("Compte créé", employee ? `Lié à ${employee.last_name} ${employee.first_name}.` : undefined);
            } else {
                await updateUser(user.id, {
                    email,
                    first_name: values.first_name,
                    last_name: values.last_name,
                    ...(isSelf ? {} : { role: values.role }), // the API refuses to change your own role
                });
                notify.success("Compte modifié");
            }
            onSaved();
            onClose();
        } catch (error) {
            setMessages(applyApiErrors(error, setError, ["first_name", "last_name", "email", "role", "password"]));
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
                        {creating ? "Créer le compte" : "Enregistrer"}
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
                <Input label="Prénom" required autoFocus error={errors.first_name?.message} {...register("first_name")} />
                <Input label="Nom" required error={errors.last_name?.message} {...register("last_name")} />
            </div>
            <Input label="Adresse e-mail" type="email" required hint="Sert d'identifiant de connexion." error={errors.email?.message} {...register("email")} />

            {isSelf ? (
                <Input label="Rôle" value={ROLE_LABELS[user.role]} hint="Vous ne pouvez pas modifier votre propre rôle." disabled readOnly />
            ) : (
                <Select label="Rôle" required hint={ROLE_HINTS[role]} error={errors.role?.message} {...register("role")}>
                    {(Object.keys(ROLE_LABELS) as Role[]).map((value) => (
                        <option key={value} value={value}>
                            {ROLE_LABELS[value]}
                        </option>
                    ))}
                </Select>
            )}

            {creating && (
                <>
                    <div className="space-y-3">
                        <PasswordField
                            label="Mot de passe initial"
                            required
                            autoComplete="new-password"
                            hint="8 caractères minimum, ni uniquement numérique, ni trop courant. L'utilisateur pourra le changer depuis son profil."
                            error={errors.password?.message}
                            {...register("password")}
                        />
                        <div className="flex flex-wrap items-center gap-3">
                            <Button size="sm" variant="secondary" onClick={suggestPassword}>
                                Générer un mot de passe sécurisé
                            </Button>
                            {generated && (
                                <>
                                    <code className="border-2 border-ink bg-gray-light px-2 py-1 font-mono text-sm">{generated}</code>
                                    <Button size="sm" variant="ghost" onClick={() => void copyPassword()}>
                                        Copier
                                    </Button>
                                </>
                            )}
                        </div>
                        {generated && (
                            <p className="text-sm text-gray-dark">
                                Transmettez-le par un canal sûr. Il ne sera plus affiché après la création du compte.
                            </p>
                        )}
                    </div>

                    <EmployeePicker
                        label="Employé à lier (facultatif)"
                        hint="Permet à l'utilisateur de consulter son propre dossier. Tapez au moins 2 lettres."
                        value={employee}
                        onChange={setEmployee}
                    />
                </>
            )}
        </ModalForm>
    );
}

export function UserFormModal({ open, ...body }: BodyProps & { open: boolean }) {
    return (
        <Modal open={open} onClose={body.onClose} title={body.user ? "Modifier le compte" : "Nouveau compte utilisateur"} padded={false}>
            <UserFormBody {...body} />
        </Modal>
    );
}