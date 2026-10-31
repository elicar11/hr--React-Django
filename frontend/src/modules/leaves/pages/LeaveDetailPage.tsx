import { Ban, Check, FileText, FileX, History, Pencil, X } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import {
    Alert,
    Button,
    Card,
    DefinitionList,
    EmptyState,
    PageHeader,
    Skeleton,
    StatusBadge,
    TabPanel,
    Tabs,
    buttonStyles,
} from "@/components/ui";
import { formatDate, formatDateTime, formatDecimal } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useSession } from "@/modules/auth/sessionContext";
import { LeaveDecisionDialogs, type DecisionTarget } from "../components/LeaveDecisionDialogs";
import { LeaveDocumentsTab } from "../components/LeaveDocumentsTab";
import { LeaveHistoryTab } from "../components/LeaveHistoryTab";
import { LeaveRequestModal } from "../components/LeaveRequestModal";
import { getAllLeaveTypes, getLeaveRequest } from "../services/leaveService";

const TABS = [
    { id: "documents", label: "Justificatifs", icon: FileText },
    { id: "history", label: "Historique", icon: History },
];

/** Detail of a request: ADMIN / HR, or the employee who owns it (the API answers 404 to anyone else). */
export function LeaveDetailPage() {
    const { id } = useParams();
    const leaveId = Number(id);
    const { user } = useSession();
    const staff = user.role === "ADMIN" || user.role === "HR";
    const backTo = staff ? "/leaves" : "/my/leaves";
    const [searchParams, setSearchParams] = useSearchParams();
    const [version, setVersion] = useState(0);
    const refresh = () => setVersion((current) => current + 1);
    const [editing, setEditing] = useState(false);
    const [decision, setDecision] = useState<DecisionTarget | null>(null);

    const query = useApiQuery(["leave", leaveId, version], (signal) => getLeaveRequest(leaveId, signal));
    const types = useApiQuery(["leave-types-all"], (signal) => getAllLeaveTypes(signal, false));
    const leave = query.data;
    const tab = searchParams.get("tab") === "history" ? "history" : "documents";

    if (query.error && !leave) {
        return (
            <>
                <PageHeader title="Demande de congé" />
                <EmptyState
                    icon={FileX}
                    title={query.error.status === 404 ? "Demande introuvable" : "Chargement impossible"}
                    description={query.error.message}
                    action={<Link to={backTo} className={buttonStyles()}>Retour à la liste</Link>}
                />
            </>
        );
    }
    if (!leave) return <Skeleton className="h-96" />;

    const type = types.data?.find((item) => item.id === leave.leave_type);
    const pending = leave.status === "PENDING";
    const open = pending || leave.status === "APPROVED";
    const years = Object.entries(leave.days_by_year);

    return (
        <>
            <PageHeader
                title={`Congé · ${leave.leave_type_name}`}
                breadcrumb={[{ label: staff ? "Congés" : "Mes congés", to: backTo }, { label: `${formatDate(leave.start_date)} → ${formatDate(leave.end_date)}` }]}
                actions={
                    <>
                        {staff && pending && (
                            <>
                                <Button onClick={() => setDecision({ leave, kind: "approve" })} leftIcon={<Check className="size-4" aria-hidden="true" />}>
                                    Approuver
                                </Button>
                                <Button variant="danger" onClick={() => setDecision({ leave, kind: "reject" })} leftIcon={<X className="size-4" aria-hidden="true" />}>
                                    Refuser
                                </Button>
                            </>
                        )}
                        {pending && (
                            <Button variant="secondary" onClick={() => setEditing(true)} leftIcon={<Pencil className="size-4" aria-hidden="true" />}>
                                Modifier
                            </Button>
                        )}
                        {open && (
                            <Button variant="secondary" onClick={() => setDecision({ leave, kind: "cancel" })} leftIcon={<Ban className="size-4" aria-hidden="true" />}>
                                Annuler
                            </Button>
                        )}
                    </>
                }
            />

            {query.error && <Alert tone="error" className="mb-4">{query.error.message}</Alert>}
            {pending && type?.requires_document && leave.documents_count === 0 && (
                <Alert tone="warning" title="Justificatif obligatoire" className="mb-4">
                    Ce type de congé exige un justificatif : la demande ne pourra pas être approuvée sans lui. Ajoutez-le dans l'onglet « Justificatifs ».
                </Alert>
            )}

            <Card title="Demande" actions={<StatusBadge domain="leave" status={leave.status} />} className="mb-6">
                <DefinitionList
                    items={[
                        {
                            label: "Employé",
                            value: staff ? (
                                <Link to={`/employees/${leave.employee}`} className="underline underline-offset-4 hover:bg-ink hover:text-paper">
                                    {leave.employee_name} ({leave.employee_matricule})
                                </Link>
                            ) : (
                                leave.employee_name
                            ),
                        },
                        { label: "Département", value: leave.department_name },
                        { label: "Type de congé", value: leave.leave_type_name },
                        { label: "Période", value: `${formatDate(leave.start_date)} → ${formatDate(leave.end_date)}` },
                        {
                            label: "Jours décomptés",
                            value: (
                                <span>
                                    <strong className="font-display text-2xl">{formatDecimal(leave.days)}</strong>{" "}
                                    {years.length > 1 && (
                                        <span className="text-sm text-gray-dark">
                                            ({years.map(([year, days]) => `${formatDecimal(days)} en ${year}`).join(", ")})
                                        </span>
                                    )}
                                </span>
                            ),
                        },
                        { label: "Demandée le", value: formatDateTime(leave.created_at) },
                        { label: "Motif", value: leave.reason },
                        ...(leave.decided_at ? [{ label: "Décision le", value: formatDateTime(leave.decided_at) }] : []),
                        ...(leave.decision_comment ? [{ label: "Commentaire de la décision", value: leave.decision_comment }] : []),
                    ]}
                />
                <p className="mt-4 text-sm text-gray-dark">Le décompte est calculé par le serveur à la création de la demande et conservé tel quel.</p>
            </Card>

            <Tabs
                idPrefix="leave"
                label="Sections de la demande"
                items={TABS}
                value={tab}
                onChange={(next) => {
                    const params = new URLSearchParams(searchParams);
                    if (next === "documents") params.delete("tab");
                    else params.set("tab", next);
                    setSearchParams(params, { replace: true });
                }}
            />
            <TabPanel idPrefix="leave" id="documents" active={tab === "documents"}>
                <LeaveDocumentsTab leaveId={leave.id} status={leave.status} />
            </TabPanel>
            <TabPanel idPrefix="leave" id="history" active={tab === "history"}>
                <LeaveHistoryTab leaveId={leave.id} version={version} />
            </TabPanel>

            <LeaveRequestModal open={editing} leave={leave} asHr={staff} onClose={() => setEditing(false)} onSaved={refresh} />
            <LeaveDecisionDialogs target={decision} onClose={() => setDecision(null)} onDone={refresh} />
        </>
    );
}