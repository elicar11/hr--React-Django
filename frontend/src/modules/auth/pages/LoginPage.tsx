import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import { z } from "zod";
import { Alert, Button, Input, PasswordField } from "@/components/ui";
import { toApiError } from "@/lib/api";
import { useAuth } from "../authContext";
import { AuthLayout } from "../../../components/AuthLayout";
import { throttleMessage } from "../errors";

const schema = z.object({
    email: z.email("Adresse e-mail invalide."),
    password: z.string().min(1, "Le mot de passe est obligatoire."),
});
type LoginForm = z.infer<typeof schema>;

function loginErrorMessage(error: unknown): string {
    const apiError = toApiError(error);
    // Same message for an unknown account, a wrong password or a disabled account.
    if (apiError.status === 401) return "E-mail ou mot de passe incorrect.";
    if (apiError.status === 429) return throttleMessage(apiError);
    return apiError.message;
}

export function LoginPage() {
    const { login, notice } = useAuth();
    const [formError, setFormError] = useState<string | null>(null);
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginForm>({ resolver: zodResolver(schema) });

    async function onSubmit(values: LoginForm) {
        setFormError(null);
        try {
            // On success the route guard redirects to the page that was asked for.
            await login(values.email.trim(), values.password);
        } catch (error) {
            setFormError(loginErrorMessage(error));
        }
    }

    return (
        <AuthLayout title="Connexion" description="Accédez à votre espace de gestion des ressources humaines.">
            {notice && <Alert tone="info">{notice}</Alert>}
            {formError && (
                <Alert tone="error" title="Connexion impossible">
                    {formError}
                </Alert>
            )}
            <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                    label="Adresse e-mail"
                    type="email"
                    autoComplete="username"
                    autoFocus
                    required
                    error={errors.email?.message}
                    {...register("email")}
                />
                <PasswordField
                    label="Mot de passe"
                    autoComplete="current-password"
                    required
                    error={errors.password?.message}
                    {...register("password")}
                />
                <Button type="submit" loading={isSubmitting} className="w-full">
                    Se connecter
                </Button>
            </form>
            <p className="text-sm">
                <Link to="/forgot-password" className="font-bold underline underline-offset-4 hover:bg-ink hover:text-paper">
                    Mot de passe oublié ?
                </Link>
            </p>
        </AuthLayout>
    );
}