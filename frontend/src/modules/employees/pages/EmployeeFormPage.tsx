import { zodResolver } from "@hookform/resolvers/zod";
import { UserX } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";
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
import { useSession } from "@/modules/auth/sessionContext";
import {
    flattenDepartments,
    getAllPositions,
    getDepartmentTree,
} from "@/modules/organization/services/organizationService";
import { getAllActiveUsers } from "@/modules/users/services/userService";
import { createEmployee, getEmployee, updateEmployee } from "../services/employeeService";
import type { Employee, EmployeeInput } from "../types";

const optionalEmail = z
    .string()
    .trim()
    .refine((value) => value === "" || z.email().safeParse(value).success, "Adresse e-mail invalide.");

const schema = z.object({
    matricule: z.string().trim().min(1, "Le matricule est obligatoire.").max(20, "20 caractères maximum."),
    last_name: z.string().trim().min(1, "Le nom est obligatoire."),
    first_name: z.string().trim().min(1, "Le prénom est obligatoire."),
    date_of_birth: z.string().min(1, "La date de naissance est obligatoire."),
    work_email: optionalEmail,
    personal_email: optionalEmail,
    work_phone: z.string(),
    personal_phone: z.string(),
    address_line: z.string(),
    postal_code: z.string(),
    city: z.string(),
    hire_date: z.string().min(1, "La date d'embauche est obligatoire."),
    department: z.string(),
    position: z.string(),
    user: z.string(),
});
type FormValues = z.infer<typeof schema>;

const FIELDS = [
    "matricule", "last_name", "first_name", "date_of_birth", "work_email", "personal_email",
    "work_phone", "personal_phone", "address_line", "postal_code", "city", "hire_date",
    "department", "position", "user",
] as const;

function EmployeeFormBody({ employee }: { employee: Employee | null }) {
    const navigate = useNavigate();
    const { user: currentUser } = useSession();
    const isAdmin = currentUser.role === "ADMIN";
    const creating = employee === null;
    const [messages, setMessages] = useState<string[]>([]);

    const tree = useApiQuery(["departments-tree"], (signal) => getDepartmentTree(signal));
    const positions = useApiQuery(["positions-active"], (signal) => getAllPositions(signal));
    // Linking an account needs the list of accounts, which only an ADMIN can read.
    const accounts = useApiQuery(["users-active", isAdmin], (signal) =>
        isAdmin ? getAllActiveUsers(signal) : Promise.resolve([]),
    );

    const {
        register,
        handleSubmit,
        control,
        setValue,
        setError,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            matricule: employee?.matricule ?? "",
            last_name: employee?.last_name ?? "",
            first_name: employee?.first_name ?? "",
            date_of_birth: employee?.date_of_birth ?? "",
            work_email: employee?.work_email ?? "",
            personal_email: employee?.personal_email ?? "",
            work_phone: employee?.work_phone ?? "",
            personal_phone: employee?.personal_phone ?? "",
            address_line: employee?.address_line ?? "",
            postal_code: employee?.postal_code ?? "",
            city: employee?.city ?? "",
            hire_date: employee?.hire_date ?? "",
            department: "",
            position: "",
            user: employee?.user ? String(employee.user) : "",
        },
    });

    const department = useWatch({ control, name: "department" });
    const positionOptions = (positions.data ?? []).filter(
        (position) => position.department === null || String(position.department) === department,
    );

    async function onSubmit(values: FormValues) {
        setMessages([]);
        if (creating) {
            if (!values.department) return setError("department", { message: "Choisissez un département." });
            if (!values.position) return setError("position", { message: "Choisissez un poste." });
        }

        const input: EmployeeInput = {
            matricule: values.matricule.toUpperCase(),
            last_name: values.last_name,
            first_name: values.first_name,
            date_of_birth: values.date_of_birth,
            work_email: values.work_email || null,
            personal_email: values.personal_email,
            work_phone: values.work_phone,
            personal_phone: values.personal_phone,
            address_line: values.address_line,
            postal_code: values.postal_code,
            city: values.city,
            hire_date: values.hire_date,
            ...(isAdmin ? { user: values.user ? Number(values.user) : null } : {}),
        };

        try {
            const saved = creating
                ? await createEmployee({ ...input, department: Number(values.department), position: Number(values.position) })
                : await updateEmployee(employee.id, input);
            notify.success(creating ? "Employé créé" : "Employé modifié");
            navigate(`/employees/${saved.id}`);
        } catch (error) {
            setMessages(applyApiErrors(error, setError, FIELDS));
        }
    }

    const title = creating ? "Nouvel employé" : `Modifier ${employee.first_name} ${employee.last_name}`;

    return (
        <>
            <PageHeader
                title={title}
                breadcrumb={[
                    { label: "Employés", to: "/employees" },
                    ...(creating ? [] : [{ label: `${employee.last_name} ${employee.first_name}`, to: `/employees/${employee.id}` }]),
                    { label: creating ? "Nouveau" : "Modifier" },
                ]}
            />

            <form noValidate onSubmit={handleSubmit(onSubmit)} className="max-w-4xl space-y-6">
                {messages.length > 0 && (
                    <Alert tone="error" title="Enregistrement impossible">
                        {messages.map((message) => (
                            <p key={message}>{message}</p>
                        ))}
                    </Alert>
                )}

                <FormSection title="Identité">
                    <Input label="Matricule" required hint="Unique, en majuscules." className="uppercase" error={errors.matricule?.message} {...register("matricule")} />
                    <span className="hidden md:block" />
                    <Input label="Nom" required error={errors.last_name?.message} {...register("last_name")} />
                    <Input label="Prénom" required error={errors.first_name?.message} {...register("first_name")} />
                    <DateField label="Date de naissance" required error={errors.date_of_birth?.message} {...register("date_of_birth")} />
                </FormSection>

                <FormSection title="Coordonnées">
                    <Input label="E-mail professionnel" type="email" error={errors.work_email?.message} {...register("work_email")} />
                    <Input label="E-mail personnel" type="email" error={errors.personal_email?.message} {...register("personal_email")} />
                    <Input label="Téléphone professionnel" type="tel" error={errors.work_phone?.message} {...register("work_phone")} />
                    <Input label="Téléphone personnel" type="tel" error={errors.personal_phone?.message} {...register("personal_phone")} />
                </FormSection>

                <FormSection title="Adresse">
                    <Input className="md:col-span-2" label="Adresse" error={errors.address_line?.message} {...register("address_line")} />
                    <Input label="Code postal" error={errors.postal_code?.message} {...register("postal_code")} />
                    <Input label="Ville" error={errors.city?.message} {...register("city")} />
                </FormSection>

                <FormSection title="Emploi">
                    <DateField label="Date d'embauche" required error={errors.hire_date?.message} {...register("hire_date")} />
                    <span className="hidden md:block" />
                    {creating ? (
                        <>
                            <Select
                                label="Département"
                                required
                                placeholder="Choisir…"
                                error={errors.department?.message}
                                {...register("department", { onChange: () => setValue("position", "") })}
                            >
                                {flattenDepartments(tree.data ?? []).map((option) => (
                                    <option key={option.id} value={option.id}>
                                        {option.label}
                                    </option>
                                ))}
                            </Select>
                            <Select
                                label="Poste"
                                required
                                placeholder={department ? "Choisir…" : "Choisissez d'abord un département"}
                                hint="Seuls les postes du département (ou transversaux) sont proposés."
                                error={errors.position?.message}
                                {...register("position")}
                            >
                                {positionOptions.map((position) => (
                                    <option key={position.id} value={position.id}>
                                        {position.code} · {position.title}
                                    </option>
                                ))}
                            </Select>
                        </>
                    ) : (
                        <div className="md:col-span-2">
                            <Alert tone="info">
                                Affectation actuelle : <strong>{employee.department_name}</strong>, {employee.position_title}. Pour la
                                modifier, utilisez l'onglet « Emploi et affectation » de la fiche : l'historique est conservé.
                            </Alert>
                        </div>
                    )}
                </FormSection>

                {isAdmin && (
                    <FormSection title="Compte utilisateur" description="Permet à l'employé de consulter son propre dossier.">
                        <Select label="Compte lié" placeholder="Aucun compte lié" error={errors.user?.message} {...register("user")}>
                            {(accounts.data ?? []).map((account) => (
                                <option key={account.id} value={account.id}>
                                    {account.last_name} {account.first_name} · {account.email}
                                </option>
                            ))}
                        </Select>
                    </FormSection>
                )}

                <div className="flex flex-wrap gap-3">
                    <Button type="submit" loading={isSubmitting}>
                        Enregistrer
                    </Button>
                    <Link to={creating ? "/employees" : `/employees/${employee.id}`} className={buttonStyles({ variant: "secondary" })}>
                        Annuler
                    </Link>
                </div>
            </form>
        </>
    );
}

/** Create (`/employees/new`) and edit (`/employees/:id/edit`) share the same form. */
export function EmployeeFormPage() {
    const { id } = useParams();
    const employeeId = id ? Number(id) : null;
    const query = useApiQuery(["employee-form", employeeId], (signal) =>
        employeeId === null ? Promise.resolve(null) : getEmployee(employeeId, signal),
    );

    if (employeeId === null) return <EmployeeFormBody key="new" employee={null} />;

    if (query.error) {
        return (
            <>
                <PageHeader title="Modifier un employé" />
                <EmptyState
                    icon={UserX}
                    title={query.error.status === 404 ? "Employé introuvable" : "Chargement impossible"}
                    description={query.error.message}
                    action={
                        <Link to="/employees" className={buttonStyles()}>
                            Retour à la liste
                        </Link>
                    }
                />
            </>
        );
    }
    if (!query.data) return <Skeleton className="h-96" />;
    return <EmployeeFormBody key={employeeId} employee={query.data} />;
}