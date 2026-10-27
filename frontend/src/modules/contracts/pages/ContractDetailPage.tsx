import { Clock, FileText, FileX, Pencil, Repeat, Trash2, XCircle, CircleCheck, History } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import {
    Alert,
    Button,
    Card,
    ConfirmDialog,
    DefinitionList,
    EmptyState,
    PageHeader,
    Skeleton,
    StatusBadge,
    TabPanel,
    Tabs,
    buttonStyles,
} from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { notify } from "@/lib/notify";
import { ActivateModal } from "../components/ActivateModal";
import { ContractDocumentsTab } from "../components/ContractDocumentsTab";
import { ContractHistoryTab } from "../components/ContractHistoryTab";
import { RenewModal } from "../components/RenewModal";
import { TerminateContractModal } from "../components/TerminateContractModal";
import { deleteContract, getContract } from "../services/contractService";

const TABS = [
    { id: "documents", label: "Documents", icon: FileText },
    { id: "history", label: "Historique", icon: History },
];

type Dialog = "activate" | "renew" | "terminate" | "delete" | null;

export function ContractDetailPage() {
    const { id } = useParams();
    const contractId = Number(id);
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [version, setVersion] = useState(0);
    const refresh = () => setVersion((current) => current + 1);
    const [dialog, setDialog] = useState<Dialog>(null);

    const query = useApiQuery(["contract", contractId, version], (signal) => getContract(contractId, signal));
    const contract = query.data;
    const tab = searchParams.get("tab") === "history" ? "history" : "documents";

    if (query.error && !contract) {
        return (
            <>
                <PageHeader title="Contrat" />
                <EmptyState
                    icon={FileX}
                    title={query.error.status === 404 ? "Contrat introuvable" : "Chargement impossible"}
                    description={query.error.message}
                    action={<Link to="/contracts" className={buttonStyles()}>Retour à la liste</Link>}
                />
            </>
        );
    }
    if (!contract) return <Skeleton className="h-96" />;

    const isDraft = contract.status === "DRAFT";
    const isRunning = contract.status === "ACTIVE";

    return (
        <>
            <PageHeader
                title={`Contrat ${contract.reference}`}
                breadcrumb={[{ label: "Contrats", to: "/contracts" }, { label: contract.reference }]}
                actions={
                    <>
                        {isDraft && (
                            <>
                                <Link to={`/contracts/${contract.id}/edit`} className={buttonStyles({ variant: "secondary" })}>
                                    <Pencil className="size-4" aria-hidden="true" />
                                    Modifier
                                </Link>
                                <Button onClick={() => setDialog("activate")} leftIcon={<CircleCheck className="size-4" aria-hidden="true" />}>
                                    Activer
                                </Button>
                                <Button variant="danger" onClick={() => setDialog("delete")} leftIcon={<Trash2 className="size-4" aria-hidden="true" />}>
                                    Supprimer
                                </Button>
                            </>
                        )}
                        {isRunning && (
                            <>
                                {contract.renewed_by === null && (
                                    <Button variant="secondary" onClick={() => setDialog("renew")} leftIcon={<Repeat className="size-4" aria-hidden="true" />}>
                                        Renouveler
                                    </Button>
                                )}
                                <Button variant="danger" onClick={() => setDialog("terminate")} leftIcon={<XCircle className="size-4" aria-hidden="true" />}>
                                    Rompre
                                </Button>
                            </>
                        )}
                    </>
                }
            />

            {query.error && (
                <Alert tone="error" className="mb-4">
                    {query.error.message}
                </Alert>
            )}
            {!isDraft && (
                <Alert tone="info" className="mb-4">
                    Les conditions de ce contrat sont figées. {isRunning ? "Pour les changer, renouvelez-le." : ""}
                </Alert>
            )}

            <Card
                title="Conditions"
                actions={<StatusBadge domain="contract" status={contract.status} />}
                className="mb-6"
            >
                <DefinitionList
                    items={[
                        {
                            label: "Employé",
                            value: (
                                <Link to={`/employees/${contract.employee}`} className="underline underline-offset-4 hover:bg-ink hover:text-paper">
                                    {contract.employee_name} ({contract.employee_matricule})
                                </Link>
                            ),
                        },
                        { label: "Type de contrat", value: contract.contract_type_name },
                        { label: "Poste", value: contract.position_title },
                        { label: "Rémunération de base", value: formatMoney(contract.base_salary, contract.currency) },
                        { label: "Date de début", value: formatDate(contract.start_date) },
                        { label: "Date de fin", value: contract.end_date ? formatDate(contract.end_date) : "Durée indéterminée" },
                        { label: "Période d'essai", value: contract.probation_days ? `${contract.probation_days} jours` : "" },
                        { label: "Date de signature", value: formatDate(contract.signed_date) },
                        ...(contract.renews
                            ? [
                                {
                                    label: "Renouvelle",
                                    value: (
                                        <Link to={`/contracts/${contract.renews}`} className="underline underline-offset-4 hover:bg-ink hover:text-paper">
                                            Voir le contrat précédent
                                        </Link>
                                    ),
                                },
                            ]
                            : []),
                        ...(contract.renewed_by
                            ? [
                                {
                                    label: "Renouvelé par",
                                    value: (
                                        <Link to={`/contracts/${contract.renewed_by}`} className="underline underline-offset-4 hover:bg-ink hover:text-paper">
                                            Voir le renouvellement
                                        </Link>
                                    ),
                                },
                            ]
                            : []),
                    ]}
                />
                {contract.days_remaining !== null && isRunning && (
                    <p className="mt-4 flex items-center gap-2 text-sm font-bold">
                        <Clock className="size-4" aria-hidden="true" />
                        {contract.days_remaining < 0
                            ? `Date de fin dépassée de ${Math.abs(contract.days_remaining)} jour(s) : le contrat sera clôturé automatiquement.`
                            : `${contract.days_remaining} jour(s) avant la fin.`}
                    </p>
                )}
            </Card>

            <Tabs
                idPrefix="contract"
                label="Sections du contrat"
                items={TABS}
                value={tab}
                onChange={(next) => {
                    const params = new URLSearchParams(searchParams);
                    if (next === "documents") params.delete("tab");
                    else params.set("tab", next);
                    setSearchParams(params, { replace: true });
                }}
            />
            <TabPanel idPrefix="contract" id="documents" active={tab === "documents"}>
                <ContractDocumentsTab contractId={contract.id} />
            </TabPanel>
            <TabPanel idPrefix="contract" id="history" active={tab === "history"}>
                <ContractHistoryTab contractId={contract.id} />
            </TabPanel>

            <ActivateModal open={dialog === "activate"} contract={contract} onClose={() => setDialog(null)} onSaved={refresh} />
            <TerminateContractModal open={dialog === "terminate"} contract={contract} onClose={() => setDialog(null)} onSaved={refresh} />
            <RenewModal
                open={dialog === "renew"}
                contract={contract}
                onClose={() => setDialog(null)}
                onRenewed={(renewal) => navigate(`/contracts/${renewal.id}`)}
            />
            <ConfirmDialog
                open={dialog === "delete"}
                onClose={() => setDialog(null)}
                tone="danger"
                title="Supprimer ce brouillon ?"
                message={
                    <>
                        Le brouillon <strong>{contract.reference}</strong> sera définitivement supprimé, avec ses documents. Un contrat
                        signé ne peut pas être supprimé.
                    </>
                }
                confirmLabel="Supprimer"
                onConfirm={async () => {
                    await deleteContract(contract.id);
                    notify.success("Brouillon supprimé");
                    navigate("/contracts", { replace: true });
                }}
            />
        </>
    );
}