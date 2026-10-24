import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { z } from "zod";
import { Alert, Button, Card, DefinitionList, PageHeader, PasswordField } from "@/components/ui";
import { toApiError } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/format";
import { applyApiErrors } from "@/lib/forms";
import { useAuth } from "../authContext";
import { throttleMessage } from "../errors";
import { changePassword } from "../services/authService";
import { ROLE_LABELS } from "../types";

const schema = z
    .object({
        old_password: z.string().min(1, "Saisissez votre mot de passe actuel."),
        new_password: z.string().min(1, "Saisissez un nouveau mot de passe."),
        confirm: z.string().min(1, "Confirmez le nouveau mot de passe."),
    })
    .refine((values) => values.new_password === values.confirm, {
        path: ["confirm"],
        message: "Les mots de passe ne correspondent pas.",
    });
type PasswordForm = z.infer<typeof schema>;

export function ProfilePage() {
    const { user, endSession } = useAuth();
    const navigate = useNavigate();
    const [messages, setMessages] = useState<string[]>([]);
    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<PasswordForm>({ resolver: zodResolver(schema) });

    if (!user) return null; // the route is protected: never reached without a user

    async function onSubmit(values: PasswordForm) {
        setMessages([]);
        try {
            await changePassword(values.old_password, values.new_password);
            // The API revoked every session of the account: sign in again with the new password.
            endSession("Mot de passe modifié. Reconnectez-vous avec votre nouveau mot de passe.");
            navigate("/login", { replace: true });
        } catch (error) {
            const apiError = toApiError(error);
            if (apiError.status === 429) return setMessages([throttleMessage(apiError)]);
            setMessages(applyApiErrors(error, setError, ["old_password", "new_password"]));
        }
    }

    return (
        <>
            <PageHeader title="Mon profil" description="Vos informations de compte et votre mot de passe." />
            <div className="grid gap-6 lg:grid-cols-2">
                <Card title="Informations">
                    <DefinitionList
                        items={[
                            { label: "Nom", value: `${user.first_name} ${user.last_name}` },
                            { label: "Adresse e-mail", value: user.email },
                            { label: "Rôle", value: ROLE_LABELS[user.role] },
                            { label: "Dernière connexion", value: formatDateTime(user.last_login) },
                            { label: "Compte créé le", value: formatDate(user.date_joined) },
                        ]}
                    />
                </Card>

                <Card title="Changer le mot de passe">
                    <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <Alert tone="info">Après le changement, vous serez déconnecté de tous vos appareils.</Alert>
                        {messages.length > 0 && (
                            <Alert tone="error">
                                {messages.map((message) => (
                                    <p key={message}>{message}</p>
                                ))}
                            </Alert>
                        )}
                        <PasswordField
                            label="Mot de passe actuel"
                            autoComplete="current-password"
                            required
                            error={errors.old_password?.message}
                            {...register("old_password")}
                        />
                        <PasswordField
                            label="Nouveau mot de passe"
                            autoComplete="new-password"
                            required
                            hint="8 caractères minimum, ni uniquement numérique, ni trop courant."
                            error={errors.new_password?.message}
                            {...register("new_password")}
                        />
                        <PasswordField
                            label="Confirmation"
                            autoComplete="new-password"
                            required
                            error={errors.confirm?.message}
                            {...register("confirm")}
                        />
                        <Button type="submit" loading={isSubmitting}>
                            Changer le mot de passe
                        </Button>
                    </form>
                </Card>
            </div>
        </>
    );
}