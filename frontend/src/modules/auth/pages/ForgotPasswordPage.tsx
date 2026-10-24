import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import { z } from "zod";
import { Alert, Button, Input } from "@/components/ui";
import { toApiError } from "@/lib/api";
import { AuthLayout } from "../../../components/AuthLayout";
import { throttleMessage } from "../errors";
import { requestPasswordReset } from "../services/authService";

const schema = z.object({ email: z.email("Adresse e-mail invalide.") });
type ForgotForm = z.infer<typeof schema>;

const backLink = (
    <Link to="/login" className="font-bold underline underline-offset-4 hover:bg-ink hover:text-paper">
        Retour à la connexion
    </Link>
);

export function ForgotPasswordPage() {
    const [sent, setSent] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<ForgotForm>({ resolver: zodResolver(schema) });

    async function onSubmit(values: ForgotForm) {
        setFormError(null);
        try {
            await requestPasswordReset(values.email.trim());
            setSent(true); // identical answer whether the account exists or not
        } catch (error) {
            const apiError = toApiError(error);
            setFormError(apiError.status === 429 ? throttleMessage(apiError) : apiError.message);
        }
    }

    return (
        <AuthLayout
            title="Mot de passe oublié"
            description="Saisissez votre adresse e-mail : si un compte actif correspond, vous recevrez un lien valable une heure."
            footer={backLink}
        >
            {sent ? (
                <Alert tone="success" title="Demande envoyée">
                    Si un compte actif correspond à cette adresse, un e-mail de réinitialisation vient d'être envoyé.
                    Pensez à vérifier vos courriers indésirables.
                </Alert>
            ) : (
                <>
                    {formError && <Alert tone="error">{formError}</Alert>}
                    <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <Input
                            label="Adresse e-mail"
                            type="email"
                            autoComplete="email"
                            autoFocus
                            required
                            error={errors.email?.message}
                            {...register("email")}
                        />
                        <Button type="submit" loading={isSubmitting} className="w-full">
                            Envoyer le lien
                        </Button>
                    </form>
                </>
            )}
        </AuthLayout>
    );
}