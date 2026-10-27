import { zodResolver } from "@hookform/resolvers/zod";
import { FileX } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { z } from "zod";
import {
    Alert,
    Button,
    DateField,
    EmptyState,
    FormSection,
    Input,
    PageHeader,
    Select,
    Skeleton,
    buttonStyles,
} from "@/components/ui";
import { applyApiErrors } from "@/lib/forms";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { notify } from "@/lib/notify";
import { EmployeePicker, type PickedEmployee } from "@/modules/employees/components/EmployeePicker";
import { getEmployee } from "@/modules/employees/services/employeeService";
import { getAllPositions } from "@/modules/organization/services/organizationService";
import { getPayrollCurrency } from "@/modules/payroll/services/payrollSettingsService";
import { createContract, getAllContractTypes, getContract, updateContract } from "../services/contractService";
import type { Contract } from "../types";

const schema = z.object({
    reference: z.string().trim().min(1, "La référence est obligatoire.").max(20, "20 caractères maximum."),
    contract_type: z.string().min(1, "Choisissez un type de contrat."),
    position: z.string().min(1, "Choisissez un poste."),
    start_date: z.string().min(1, "La date de début est obligatoire."),
    end_date: z.string(),
    probation_days: z.string().refine((value) => value === "" || /^[1-9]\d*$/.test(value), "Nombre de jours entier."),
    // Format check only (guides the typing): the API validates and stores the amount.
    base_salary: z
        .string()
        .trim()
        .refine((value) => /^\d+([.,]\d{1,2})?$/.test(value), "Montant invalide (ex. 1500 ou 1500,50)."),
    currency: z.string().trim().length(3, "Code devise à 3 lettres (ex. EUR)."),
});
type FormValues = z.infer<typeof schema>;

const FIELDS = [
    "reference", "contract_type", "position", "start_date", "end_date", "probation_days", "base_salary", "currency",
] as const;

function ContractFormBody({ contract, initialEmployee }: { contract: Contract | null; initialEmployee: PickedEmployee | null }) {
    const navigate = useNavigate();
    const creating = contract === null;
    const [employee, setEmployee] = useState<PickedEmployee | null>(initialEmployee);
    const [employeeError, setEmployeeError] = useState<string>();
    const [messages, setMessages] = useState<string[]>([]);

    const types = useApiQuery(["contract-types-all"], (signal) => getAllContractTypes(signal, false));
    const positions = useApiQuery(["positions-active"], (signal) => getAllPositions(signal));
    const currency = useApiQuery(["payroll-currency"], (signal) => getPayrollCurrency(signal));

    const {
        register,
        handleSubmit,
        control,
        setValue,
        getValues,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            reference: contract?.reference ?? "",
            contract_type: contract ? String(contract.contract_type) : "",
            position: contract ? String(contract.position) : "",
            start_date: contract?.start_date ?? "",
            end_date: contract?.end_date ?? "",
            probation_days: contract?.probation_days ? String(contract.probation_days) : "",
            base_salary: contract?.base_salary ?? "",
            currency: contract?.currency ?? "",
        },
    });

    // New contract: suggest the payroll currency once it is known (never overwrites what was typed).
    const suggestedCurrency = currency.data;
    useEffect(() => {
        if (creating && suggestedCurrency && !getValues("currency")) setValue("currency", suggestedCurrency);
    }, [creating, suggestedCurrency, getValues, setValue]);

    const typeId = useWatch({ control, name: "contract_type" });
    const fixedTerm = types.data?.find((type) => String(type.id) === typeId)?.is_fixed_term ?? false;

    async function onSubmit(values: FormValues) {
        setMessages([]);
        if (creating && !employee) return setEmployeeError("Choisissez un employé.");
        if (fixedTerm && !values.end_date) {
            return setError("end_date", { message: "La date de fin est obligatoire pour un contrat à durée déterminée." });
        }

        const input = {
            contract_type: Number(values.contract_type),
            reference: values.reference.toUpperCase(),
            start_date: values.start_date,
            end_date: fixedTerm ? values.end_date : null,
            position: Number(values.position),
            probation_days: values.probation_days ? Number(values.probation_days) : null,
            base_salary: values.base_salary.replace(",", "."), // decimal string, never a float
            currency: values.currency.toUpperCase(),
        };

        try {
            const saved = creating
                ? await createContract({ ...input, employee: employee!.id })
                : await updateContract(contract.id, input);
            notify.success(creating ? "Contrat créé en brouillon" : "Contrat modifié");
            navigate(`/contracts/${saved.id}`);
        } catch (error) {
            setMessages(applyApiErrors(error, setError, FIELDS));
        }
    }

    return (
        <>
            <PageHeader
                title={creating ? "Nouveau contrat" : `Modifier ${contract.reference}`}
                breadcrumb={[
                    { label: "Contrats", to: "/contracts" },
                    ...(creating ? [] : [{ label: contract.reference, to: `/contracts/${contract.id}` }]),
                    { label: creating ? "Nouveau" : "Modifier" },
                ]}
            />

            <form noValidate onSubmit={handleSubmit(onSubmit)} className="max-w-4xl space-y-6">
                {creating ? (
                    <Alert tone="info">Le contrat est créé en <strong>brouillon</strong> : il reste modifiable jusqu'à sa signature.</Alert>
                ) : (
                    <Alert tone="info">Seul un brouillon est modifiable. L'employé d'un contrat ne peut pas être changé.</Alert>
                )}
                {messages.length > 0 && (
                    <Alert tone="error" title="Enregistrement impossible">
                        {messages.map((message) => (
                            <p key={message}>{message}</p>
                        ))}
                    </Alert>
                )}

                <FormSection title="Contrat">
                    <div className="md:col-span-2">
                        {creating ? (
                            <EmployeePicker
                                required
                                value={employee}
                                onChange={(picked) => {
                                    setEmployee(picked);
                                    setEmployeeError(undefined);
                                }}
                                error={employeeError}
                            />
                        ) : (
                            <Input label="Employé" value={contract.employee_name} disabled readOnly />
                        )}
                    </div>
                    <Input label="Référence" required hint="Unique, en majuscules." className="uppercase" error={errors.reference?.message} {...register("reference")} />
                    <Select
                        label="Type de contrat"
                        required
                        placeholder="Choisir…"
                        error={errors.contract_type?.message}
                        {...register("contract_type", { onChange: () => setValue("end_date", "") })}
                    >
                        {(types.data ?? [])
                            .filter((type) => type.is_active || type.id === contract?.contract_type)
                            .map((type) => (
                                <option key={type.id} value={type.id}>
                                    {type.code} · {type.name}
                                    {type.is_fixed_term ? " (durée déterminée)" : ""}
                                </option>
                            ))}
                    </Select>
                    <Select label="Poste" required placeholder="Choisir…" error={errors.position?.message} {...register("position")}>
                        {(positions.data ?? []).map((position) => (
                            <option key={position.id} value={position.id}>
                                {position.code} · {position.title}
                            </option>
                        ))}
                    </Select>
                </FormSection>

                <FormSection title="Durée">
                    <DateField label="Date de début" required error={errors.start_date?.message} {...register("start_date")} />
                    <DateField
                        label="Date de fin"
                        required={fixedTerm}
                        disabled={!fixedTerm}
                        hint={typeId && !fixedTerm ? "Durée indéterminée : pas de date de fin." : undefined}
                        error={errors.end_date?.message}
                        {...register("end_date")}
                    />
                    <Input label="Période d'essai (jours)" inputMode="numeric" hint="Facultatif." error={errors.probation_days?.message} {...register("probation_days")} />
                </FormSection>

                <FormSection title="Rémunération" description="Montant contractuel par période de paie. Visible uniquement par les ADMIN et RH.">
                    <Input label="Rémunération de base" required inputMode="decimal" error={errors.base_salary?.message} {...register("base_salary")} />
                    <Input label="Devise" required className="uppercase" maxLength={3} hint="Code ISO à 3 lettres." error={errors.currency?.message} {...register("currency")} />
                </FormSection>

                <div className="flex flex-wrap gap-3">
                    <Button type="submit" loading={isSubmitting}>
                        Enregistrer
                    </Button>
                    <Link to={creating ? "/contracts" : `/contracts/${contract.id}`} className={buttonStyles({ variant: "secondary" })}>
                        Annuler
                    </Link>
                </div>
            </form>
        </>
    );
}

/** Create (`/contracts/new`, optional `?employee=ID`) and edit (`/contracts/:id/edit`, drafts only). */
export function ContractFormPage() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const contractId = id ? Number(id) : null;
    const presetEmployee = contractId === null ? Number(searchParams.get("employee")) || null : null;

    const contractQuery = useApiQuery(["contract-form", contractId], (signal) =>
        contractId === null ? Promise.resolve(null) : getContract(contractId, signal),
    );
    const employeeQuery = useApiQuery(["contract-form-employee", presetEmployee], (signal) =>
        presetEmployee === null ? Promise.resolve(null) : getEmployee(presetEmployee, signal),
    );

    if (contractId !== null) {
        if (contractQuery.error) {
            return (
                <>
                    <PageHeader title="Modifier un contrat" />
                    <EmptyState
                        icon={FileX}
                        title={contractQuery.error.status === 404 ? "Contrat introuvable" : "Chargement impossible"}
                        description={contractQuery.error.message}
                        action={<Link to="/contracts" className={buttonStyles()}>Retour à la liste</Link>}
                    />
                </>
            );
        }
        if (!contractQuery.data) return <Skeleton className="h-96" />;
        if (contractQuery.data.status !== "DRAFT") {
            return (
                <>
                    <PageHeader title={`Contrat ${contractQuery.data.reference}`} />
                    <EmptyState
                        icon={FileX}
                        title="Ce contrat n'est plus modifiable"
                        description="Seul un brouillon peut être modifié. Pour changer les conditions d'un contrat en cours, renouvelez-le."
                        action={<Link to={`/contracts/${contractQuery.data.id}`} className={buttonStyles()}>Voir le contrat</Link>}
                    />
                </>
            );
        }
        return <ContractFormBody key={contractId} contract={contractQuery.data} initialEmployee={null} />;
    }

    if (presetEmployee !== null && employeeQuery.loading && !employeeQuery.data) return <Skeleton className="h-96" />;
    return <ContractFormBody key="new" contract={null} initialEmployee={employeeQuery.data} />;
}