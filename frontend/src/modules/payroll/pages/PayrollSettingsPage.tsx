import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Card, Checkbox, ConfirmDialog, Input, PageHeader, Skeleton } from "@/components/ui";
import { DECIMAL_PATTERN, toDecimalString } from "@/lib/decimal";
import { formatDateTime } from "@/lib/format";
import { applyApiErrors } from "@/lib/forms";
import { notify } from "@/lib/notify";
import { useSession } from "@/modules/auth/sessionContext";
import { PayrollBanner } from "../components/PayrollBanner";
import { usePayrollSettings } from "../hooks";
import { updatePayrollSettings } from "../services/payrollService";
import type { PayrollSettings } from "../types";

const optionalDecimal = z
    .string()
    .refine((value) => value.trim() === "" || DECIMAL_PATTERN.test(value.trim()), "Nombre invalide (ex. 160 ou 1,5).");

const schema = z.object({
    currency: z.string().trim().refine((value) => value === "" || /^[A-Za-z]{3}$/.test(value), "Code ISO à 3 lettres (ex. EUR)."),
    country: z.string().max(100, "100 caractères maximum."),
    monthly_hours: optionalDecimal,
    overtime_multiplier: optionalDecimal,
    prorate_partial_periods: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

function SettingsForm({ settings, onSaved }: { settings: PayrollSettings; onSaved: () => void }) {
    const [messages, setMessages] = useState<string[]>([]);
    const {
        register,
        handleSubmit,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            currency: settings.currency,
            country: settings.country,
            monthly_hours: settings.monthly_hours ?? "",
            overtime_multiplier: settings.overtime_multiplier ?? "",
            prorate_partial_periods: settings.prorate_partial_periods,
        },
    });

    async function onSubmit(values: FormValues) {
        setMessages([]);
        try {
            await updatePayrollSettings({
                currency: values.currency.trim().toUpperCase(),
                country: values.country.trim(),
                monthly_hours: values.monthly_hours.trim() ? toDecimalString(values.monthly_hours) : null,
                overtime_multiplier: values.overtime_multiplier.trim() ? toDecimalString(values.overtime_multiplier) : null,
                prorate_partial_periods: values.prorate_partial_periods,
            });
            notify.success("Paramètres enregistrés");
            onSaved();
        } catch (error) {
            setMessages(applyApiErrors(error, setError, ["currency", "country", "monthly_hours", "overtime_multiplier", "prorate_partial_periods"]));
        }
    }

    return (
        <Card title="Paramètres" description={`Dernière modification : ${formatDateTime(settings.updated_at)}`}>
            <form noValidate onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-4">
                {messages.length > 0 && (
                    <Alert tone="error" title="Enregistrement impossible">
                        {messages.map((message) => (
                            <p key={message}>{message}</p>
                        ))}
                    </Alert>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                        label="Devise"
                        required
                        className="uppercase"
                        maxLength={3}
                        hint="Code ISO. Doit être celle des contrats. Non modifiable une fois des bulletins validés."
                        error={errors.currency?.message}
                        {...register("currency")}
                    />
                    <Input label="Pays" error={errors.country?.message} {...register("country")} />
                    <Input
                        label="Heures mensuelles de référence"
                        inputMode="decimal"
                        hint="Sert au taux horaire des heures supplémentaires. Aucune valeur n'est supposée."
                        error={errors.monthly_hours?.message}
                        {...register("monthly_hours")}
                    />
                    <Input
                        label="Majoration des heures supplémentaires"
                        inputMode="decimal"
                        hint="Multiplicateur du taux horaire (ex. 1,5)."
                        error={errors.overtime_multiplier?.message}
                        {...register("overtime_multiplier")}
                    />
                </div>
                <Checkbox
                    label="Prorata si un contrat ne couvre qu'une partie de la période"
                    hint="Au prorata des jours ouvrés. Désactivé : un contrat partiel bloque le calcul."
                    {...register("prorate_partial_periods")}
                />
                <Button type="submit" loading={isSubmitting}>
                    Enregistrer
                </Button>
            </form>
        </Card>
    );
}

export function PayrollSettingsPage() {
    const { user } = useSession();
    const isAdmin = user.role === "ADMIN";
    const query = usePayrollSettings();
    const [confirmingLive, setConfirmingLive] = useState(false);
    const [confirmingDemo, setConfirmingDemo] = useState(false);
    const settings = query.data;

    return (
        <>
            <PageHeader title="Paramètres de paie" description="Devise, heures de référence et règles de calcul." breadcrumb={[{ label: "Paie", to: "/payroll" }, { label: "Paramètres" }]} />
            <PayrollBanner />

            {query.error && <Alert tone="error" className="mb-4">{query.error.message}</Alert>}
            {!settings && query.loading && <Skeleton className="h-64" />}

            {settings && (
                <div className="space-y-6">
                    <SettingsForm key={settings.updated_at} settings={settings} onSaved={query.reload} />

                    <Card title="Mode démonstration" tone={settings.is_demo ? "muted" : "paper"}>
                        {settings.is_demo ? (
                            <div className="space-y-3">
                                <p>
                                    Les paramètres sont <strong>fictifs</strong>. Les bulletins sont marqués « Démo » et ne doivent pas servir à payer de vrais salaires.
                                </p>
                                <p className="text-sm text-gray-dark">
                                    Ne désactivez ce mode qu'une fois le pays, la devise, les cotisations, les impôts et les règles légales confirmés par un spécialiste.
                                </p>
                                {isAdmin ? (
                                    <Button variant="danger" onClick={() => setConfirmingLive(true)}>
                                        Désactiver le mode démonstration
                                    </Button>
                                ) : (
                                    <Alert tone="info">Seul un administrateur peut changer le mode démonstration.</Alert>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <p>Le mode démonstration est <strong>désactivé</strong> : les nouveaux bulletins ne sont plus marqués « Démo ».</p>
                                {isAdmin && (
                                    <Button variant="secondary" onClick={() => setConfirmingDemo(true)}>
                                        Repasser en mode démonstration
                                    </Button>
                                )}
                            </div>
                        )}
                    </Card>
                </div>
            )}

            <ConfirmDialog
                open={confirmingLive}
                onClose={() => setConfirmingLive(false)}
                tone="danger"
                title="Désactiver le mode démonstration ?"
                message={
                    <>
                        <p>Les bulletins calculés ensuite ne porteront plus la mention « Démo » et pourront être utilisés comme des documents de paie réels.</p>
                        <p className="mt-2 font-bold">Vérifiez avant que les paramètres et les types d'éléments ne sont plus fictifs.</p>
                    </>
                }
                confirmLabel="Désactiver"
                onConfirm={async () => {
                    await updatePayrollSettings({ is_demo: false });
                    notify.success("Mode démonstration désactivé");
                    query.reload();
                }}
            />
            <ConfirmDialog
                open={confirmingDemo}
                onClose={() => setConfirmingDemo(false)}
                title="Repasser en mode démonstration ?"
                message="Les bulletins calculés ensuite seront de nouveau marqués « Démo »."
                confirmLabel="Repasser en démo"
                onConfirm={async () => {
                    await updatePayrollSettings({ is_demo: true });
                    notify.success("Mode démonstration activé");
                    query.reload();
                }}
            />
        </>
    );
}