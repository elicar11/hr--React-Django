import {
    Banknote,
    Briefcase,
    Camera,
    CalendarDays,
    ChevronDown,
    Clock,
    FileText,
    History,
    Pencil,
    User,
    UserX,
} from "lucide-react";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router";
import {
    Alert,
    Card,
    ConfirmDialog,
    DefinitionList,
    EmptyState,
    Menu,
    PageHeader,
    Skeleton,
    StatusBadge,
    TabPanel,
    Tabs,
    buttonStyles,
    type MenuItem,
} from "@/components/ui";
import { formatDate } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { notify } from "@/lib/notify";
import { EmployeeAssignmentTab } from "../components/EmployeeAssignmentTab";
import { EmployeeHistoryTab } from "../components/EmployeeHistoryTab";
import { EmployeePhoto } from "../components/EmployeePhoto";
import { EmployeePhotoTab } from "../components/EmployeePhotoTab";
import {
    EmployeeAttendanceTab,
    EmployeeContractsTab,
    EmployeeLeavesTab,
    EmployeePayTab,
} from "../components/EmployeeRelatedTabs";
import { TerminateModal } from "../components/TerminateModal";
import { getEmployee, reactivateEmployee, suspendEmployee } from "../services/employeeService";
import type { Employee } from "../types";
import { GENDER_LABELS, formatCin } from "../labels";

const TABS = [
    { id: "general", label: "Général", icon: User },
    { id: "assignment", label: "Emploi et affectation", icon: Briefcase },
    { id: "contracts", label: "Contrats", icon: FileText },
    { id: "attendance", label: "Présences", icon: Clock },
    { id: "leaves", label: "Congés", icon: CalendarDays },
    { id: "pay", label: "Rémunération", icon: Banknote },
    { id: "photo", label: "Photo", icon: Camera },
    { id: "history", label: "Historique", icon: History },
];

function GeneralTab({ employee }: { employee: Employee }) {
    const { t } = useTranslation();
    const address = [employee.address_line, [employee.postal_code, employee.city].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", ");
    return (
        <Card title="Informations générales">
            <DefinitionList
                items={[
                    { label: "Matricule", value: employee.matricule },
                    { label: "Nom complet", value: `${employee.last_name} ${employee.first_name}` },
                    { label: "Sexe", value: employee.gender ? t(GENDER_LABELS[employee.gender]) : "" },
                    { label: "Date de naissance", value: formatDate(employee.date_of_birth) },
                    { label: "Date d'embauche", value: formatDate(employee.hire_date) },
                    { label: "E-mail personnel", value: employee.personal_email },
                    { label: "Téléphone personnel", value: employee.personal_phone },
                    { label: "Numéro CIN", value: formatCin(employee.cin_number) },
                    { label: "CIN délivré le", value: formatDate(employee.cin_issue_date) },
                    { label: "Lieu de délivrance", value: employee.cin_issue_place },
                    { label: "Adresse", value: address },
                    { label: "Compte de connexion", value: t(employee.user ? "Compte lié" : "Aucun compte lié") },
                    ...(employee.departure_date ? [{ label: "Date de départ", value: formatDate(employee.departure_date) }] : []),
                ]}
            />
        </Card>
    );
}

type StatusAction = "suspend" | "reactivate" | "terminate";

export function EmployeeDetailPage() {
    const { t } = useTranslation();
    const { id } = useParams();
    const employeeId = Number(id);
    const [searchParams, setSearchParams] = useSearchParams();
    const [version, setVersion] = useState(0);
    const refresh = () => setVersion((current) => current + 1);
    const [action, setAction] = useState<StatusAction | null>(null);

    const query = useApiQuery(["employee", employeeId, version], (signal) => getEmployee(employeeId, signal));
    const employee = query.data;
    const requestedTab = searchParams.get("tab") ?? "general";
    const tab = TABS.some((item) => item.id === requestedTab) ? requestedTab : "general";

    if (query.error && !employee) {
        return (
            <>
                <PageHeader title="Employé" />
                <EmptyState
                    icon={UserX}
                    title={query.error.status === 404 ? "Employé introuvable" : "Chargement impossible"}
                    description={query.error.message}
                    action={
                        <Link to="/employees" className={buttonStyles()}>
                            {t("Retour à la liste")}
                        </Link>
                    }
                />
            </>
        );
    }
    if (!employee) return <Skeleton className="h-96" />;

    const name = `${employee.first_name} ${employee.last_name}`;
    const statusItems: MenuItem[] = [];
    if (employee.employment_status === "ACTIVE") {
        statusItems.push({ label: "Suspendre", onSelect: () => setAction("suspend") });
    }
    if (employee.employment_status !== "ACTIVE") {
        statusItems.push({ label: "Réactiver", onSelect: () => setAction("reactivate") });
    }
    if (employee.employment_status !== "TERMINATED") {
        statusItems.push({ label: "Enregistrer la sortie", tone: "danger", onSelect: () => setAction("terminate") });
    }

    return (
        <>
            <PageHeader
                title={`${employee.last_name} ${employee.first_name}`}
                breadcrumb={[{ label: "Employés", to: "/employees" }, { label: name }]}
                actions={
                    <>
                        <Link to={`/employees/${employee.id}/edit`} className={buttonStyles({ variant: "secondary" })}>
                            <Pencil className="size-4" aria-hidden="true" />
                            {t("Modifier")}
                        </Link>
                        <Menu
                            label="Changer le statut"
                            align="end"
                            items={statusItems}
                            triggerClassName={buttonStyles({ variant: "secondary" })}
                            trigger={
                                <>
                                    Statut <ChevronDown className="size-4" aria-hidden="true" />
                                </>
                            }
                        />
                    </>
                }
            />

            {query.error && (
                <Alert tone="error" className="mb-4">
                    {query.error.message}
                </Alert>
            )}

            <div className="mb-6 flex flex-wrap items-center gap-5 border-2 border-ink bg-paper p-5 shadow-hard">
                <EmployeePhoto id={employee.id} hasPhoto={employee.has_photo} name={name} version={employee.updated_at} size="md" />
                <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-3">
                        <StatusBadge domain="employee" status={employee.employment_status} />
                        <span className="font-bold">{employee.matricule}</span>
                    </div>
                    <p>
                        {employee.department_name} · {employee.position_title}
                    </p>
                    <p className="text-sm text-gray-dark">
                        {t("Embauché le {{date}}", { date: formatDate(employee.hire_date) })}
                        {employee.departure_date ? ` · ${t("parti le {{date}}", { date: formatDate(employee.departure_date) })}` : ""}
                    </p>
                </div>
            </div>

            <Tabs
                idPrefix="employee"
                label="Sections de la fiche"
                items={TABS}
                value={tab}
                onChange={(next) => {
                    const params = new URLSearchParams(searchParams);
                    if (next === "general") params.delete("tab");
                    else params.set("tab", next);
                    setSearchParams(params, { replace: true });
                }}
            />
            <TabPanel idPrefix="employee" id="general" active={tab === "general"}>
                <GeneralTab employee={employee} />
            </TabPanel>
            <TabPanel idPrefix="employee" id="assignment" active={tab === "assignment"}>
                <EmployeeAssignmentTab employee={employee} onChanged={refresh} />
            </TabPanel>
            <TabPanel idPrefix="employee" id="contracts" active={tab === "contracts"}>
                <EmployeeContractsTab employeeId={employee.id} />
            </TabPanel>
            <TabPanel idPrefix="employee" id="attendance" active={tab === "attendance"}>
                <EmployeeAttendanceTab employeeId={employee.id} />
            </TabPanel>
            <TabPanel idPrefix="employee" id="leaves" active={tab === "leaves"}>
                <EmployeeLeavesTab employeeId={employee.id} />
            </TabPanel>
            <TabPanel idPrefix="employee" id="pay" active={tab === "pay"}>
                <EmployeePayTab employeeId={employee.id} />
            </TabPanel>
            <TabPanel idPrefix="employee" id="photo" active={tab === "photo"}>
                <EmployeePhotoTab employee={employee} onChanged={refresh} />
            </TabPanel>
            <TabPanel idPrefix="employee" id="history" active={tab === "history"}>
                <EmployeeHistoryTab employeeId={employee.id} />
            </TabPanel>

            <ConfirmDialog
                open={action === "suspend"}
                onClose={() => setAction(null)}
                title="Suspendre cet employé ?"
                message={
                    <>
                        <Trans i18nKey="<strong>{{name}}</strong> passera au statut « Suspendu ». Son compte de connexion n'est pas modifié." values={{ name }} components={{ strong: <strong /> }} />
                    </>
                }
                confirmLabel="Suspendre"
                onConfirm={async () => {
                    await suspendEmployee(employee.id);
                    notify.success("Employé suspendu");
                    refresh();
                }}
            />
            <ConfirmDialog
                open={action === "reactivate"}
                onClose={() => setAction(null)}
                title="Réactiver cet employé ?"
                message={
                    employee.employment_status === "TERMINATED" ? (
                        <>
                            <p>
                                <Trans i18nKey="<strong>{{name}}</strong> repassera « En poste » et sa dernière affectation sera rouverte." values={{ name }} components={{ strong: <strong /> }} />
                            </p>
                            <p className="mt-2 text-sm text-gray-dark">
                                {t("Son compte de connexion reste désactivé : il se réactive séparément, depuis la gestion des utilisateurs.")}
                            </p>
                        </>
                    ) : (
                        <>
                            <Trans i18nKey="<strong>{{name}}</strong> repassera « En poste »." values={{ name }} components={{ strong: <strong /> }} />
                        </>
                    )
                }
                confirmLabel="Réactiver"
                onConfirm={async () => {
                    await reactivateEmployee(employee.id);
                    notify.success("Employé réactivé");
                    refresh();
                }}
            />
            <TerminateModal open={action === "terminate"} employee={employee} onClose={() => setAction(null)} onSaved={refresh} />
        </>
    );
}
