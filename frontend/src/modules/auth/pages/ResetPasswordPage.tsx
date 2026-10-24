import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router";
import { z } from "zod";
import { Alert, Button, PasswordField } from "@/components/ui";
import { toApiError } from "@/lib/api";
import { applyApiErrors } from "@/lib/forms";
import { useAuth } from "../authContext";
import { AuthLayout } from "../../../components/AuthLayout";
import { throttleMessage } from "../errors";
import { confirmPasswordReset } from "../services/authService";

const schema = z
    .object({
        new_password: z.string().min(1, "Saisissez un nouveau mot de passe."),
        confirm: z.string().min(1, "Confirmez le nouveau mot de passe."),
    })
    .refine((values) => values.new_password === values.confirm, {
        path: ["confirm"],
        message: "Les mots de passe ne correspondent pas.",
    });
type ResetForm = z.infer<typeof schema>;

const newLink = (
    <Link to="/forgot-password" className="font-bold underline underline-offset-4 hover:bg-ink hover:text-paper">
        Demander un nouveau lien
    </Link>
);

export function ResetPasswordPage() {
    const [params] = useSearchParams();
    const uid = params.get("uid");
    const token = params.get("token");
    const navigate = useNavigate();
    const { endSession } = useAuth();
    const [messages, setMessages] = useState<string[]>([]);
    const [linkInvalid, setLinkInvalid] = useState(false);
    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<ResetForm>({ resolver: zodResolver(schema) });

    async function onSubmit(values: ResetForm) {
        if (!uid || !token) return;
        setMessages([]);
        try {
            await confirmPasswordReset(uid, token, values.new_password);
            // Every session of this account was revoked: start from a clean login.
            endSession("Votre mot de passe a été réinitialisé. Vous pouvez vous connecter.");
            navigate("/login", { replace: true });
        } catch (error) {
            const apiError = toApiError(error);
            if (apiError.status === 429) return setMessages([throttleMessage(apiError)]);
            if (apiError.fieldErrors.token) setLinkInvalid(true);
            setMessages(applyApiErrors(error, setError, ["new_password"]));
        }
    }

    if (!uid || !token) {
        return (
            <AuthLayout title="Lien invalide" footer={newLink}>
                <Alert tone="error">Ce lien de réinitialisation est incomplet. Utilisez le lien reçu par e-mail.</Alert>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            title="Nouveau mot de passe"
            description="Choisissez un mot de passe robuste : 8 caractères minimum, ni uniquement numérique, ni trop courant."
            footer={linkInvalid ? newLink : undefined}
        >
            {messages.length > 0 && (
                <Alert tone="error">
                    {messages.map((message) => (
                        <p key={message}>{message}</p>
                    ))}
                </Alert>
            )}
            {!linkInvalid && (
                <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <PasswordField
                        label="Nouveau mot de passe"
                        autoComplete="new-password"
                        autoFocus
                        required
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
                    <Button type="submit" loading={isSubmitting} className="w-full">
                        Enregistrer le mot de passe
                    </Button>
                </form>
            )}
        </AuthLayout>
    );
}