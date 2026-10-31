import { UserX } from "lucide-react";
import { Link } from "react-router";
import {
    Alert,
    Badge,
    Card,
    DefinitionList,
    EmptyState,
    PageHeader,
    Skeleton,
    StatusBadge,
    buttonStyles,
} from "@/components/ui";
import { formatDate } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { EmployeePhoto } from "../components/EmployeePhoto";
import { useMyEmployee } from "../hooks";
import { getAssignments } from "../services/employeeService";

const SHORTCUTS = [
    { to: "/my/contracts", label: "Mes contrats" },
    { to: "/my/leaves", label: "Mes congés" },
    { to: "/my/attendance", label: "Mes présences" },
    { to: "/my/payslips", label: "Mes bulletins" },
];

function Assignments({ employeeId }: { employeeId: number }) {
    const query = useApiQuery(["my-assignments", employeeId], (signal) => getAssignments(employeeId, signal));
    if (query.error) return <Alert tone="error">{query.error.message}</Alert>;
    if (!query.data) return <Skeleton className="h-20" />;
    if (query.data.length === 0) return <p className="text-gray-dark">Aucune affectation enregistrée.</p>;
    return (
        <ol className="divide-y-2 divide-ink border-2 border-ink">
            {query.data.map((assignment) => (
                <li key={assignment.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <div>
                        <p className="font-bold">
                            {assignment.department_name} · {assignment.position_title}
                        </p>
                        <p className="text-sm text-gray-dark">
                            Depuis le {formatDate(assignment.start_date)}
                            {assignment.end_date ? ` jusqu'au ${formatDate(assignment.end_date)}` : ""}
                        </p>
                    </div>
                    {assignment.end_date === null && <Badge tone="solid">En cours</Badge>}
                </li>
            ))}
        </ol>
    );
}

/** Read-only record of the logged-in employee. Changes go through the HR team. */
export function MyProfilePage() {
    const query = useMyEmployee();
    const employee = query.data;

    if (query.error) {
        return (
            <>
                <PageHeader title="Mon dossier" />
                <Alert tone="error">{query.error.message}</Alert>
            </>
        );
    }
    if (!employee) {
        if (query.loading || query.data === undefined) return <Skeleton className="h-96" />;
        return (
            <>
                <PageHeader title="Mon dossier" />
                <EmptyState
                    icon={UserX}
                    title="Aucun dossier employé"
                    description="Aucun dossier employé n'est associé à votre compte. Contactez les ressources humaines."
                />
            </>
        );
    }

    const name = `${employee.first_name} ${employee.last_name}`;
    const address = [employee.address_line, [employee.postal_code, employee.city].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", ");

    return (
        <>
            <PageHeader title="Mon dossier" description="Vos informations professionnelles et personnelles." />

            <div className="mb-6 flex flex-wrap items-center gap-5 border-2 border-ink bg-paper p-5 shadow-hard">
                <EmployeePhoto id={employee.id} hasPhoto={employee.has_photo} name={name} version={employee.updated_at} size="lg" />
                <div className="space-y-2">
                    <h2 className="text-3xl">{name}</h2>
                    <div className="flex flex-wrap items-center gap-3">
                        <StatusBadge domain="employee" status={employee.employment_status} />
                        <span className="font-bold">{employee.matricule}</span>
                    </div>
                    <p>
                        {employee.department_name} · {employee.position_title}
                    </p>
                    <p className="text-sm text-gray-dark">Embauché le {formatDate(employee.hire_date)}</p>
                </div>
            </div>

            <Alert tone="info" className="mb-6">
                Ces informations sont gérées par les ressources humaines : pour corriger une donnée, contactez-les. Votre mot de passe se
                change dans{" "}
                <Link to="/profile" className="font-bold underline underline-offset-4">
                    Mon compte
                </Link>
                .
            </Alert>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card title="Informations personnelles">
                    <DefinitionList
                        items={[
                            { label: "Date de naissance", value: formatDate(employee.date_of_birth) },
                            { label: "E-mail professionnel", value: employee.work_email },
                            { label: "E-mail personnel", value: employee.personal_email },
                            { label: "Téléphone professionnel", value: employee.work_phone },
                            { label: "Téléphone personnel", value: employee.personal_phone },
                            { label: "Adresse", value: address },
                        ]}
                    />
                </Card>
                <Card title="Mes affectations">
                    <Assignments employeeId={employee.id} />
                </Card>
            </div>

            <nav aria-label="Raccourcis de mon espace" className="mt-6 flex flex-wrap gap-3">
                {SHORTCUTS.map((shortcut) => (
                    <Link key={shortcut.to} to={shortcut.to} className={buttonStyles({ variant: "secondary" })}>
                        {shortcut.label}
                    </Link>
                ))}
            </nav>
        </>
    );
}