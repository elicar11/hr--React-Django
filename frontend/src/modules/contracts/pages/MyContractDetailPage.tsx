import { Download, FileText, FileX } from "lucide-react";
import { Link, useParams } from "react-router";
import {
    Alert,
    Button,
    Card,
    DefinitionList,
    EmptyState,
    PageHeader,
    Skeleton,
    StatusBadge,
    buttonStyles,
} from "@/components/ui";
import { saveFile } from "@/lib/download";
import { formatDate, formatFileSize, formatMoney } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { notify } from "@/lib/notify";
import { downloadContractDocument, getContract, listContractDocuments } from "../services/contractService";
import type { ContractDocument } from "../types";

/** Read-only detail of one of the user's own contracts. */
export function MyContractDetailPage() {
    const { id } = useParams();
    const contractId = Number(id);
    const query = useApiQuery(["my-contract", contractId], (signal) => getContract(contractId, signal));
    const documents = useApiQuery(["my-contract-documents", contractId], (signal) => listContractDocuments(contractId, signal));
    const contract = query.data;

    async function download(document: ContractDocument) {
        try {
            saveFile(await downloadContractDocument(contractId, document.id));
        } catch (error) {
            notify.error(error);
        }
    }

    if (query.error && !contract) {
        return (
            <>
                <PageHeader title="Contrat" />
                <EmptyState
                    icon={FileX}
                    title={query.error.status === 404 ? "Contrat introuvable" : "Chargement impossible"}
                    description={query.error.message}
                    action={<Link to="/my/contracts" className={buttonStyles()}>Retour à mes contrats</Link>}
                />
            </>
        );
    }
    if (!contract) return <Skeleton className="h-96" />;

    const endingSoon = contract.status === "ACTIVE" && contract.days_remaining !== null && contract.days_remaining >= 0 && contract.days_remaining <= 30;

    return (
        <>
            <PageHeader
                title={`Contrat ${contract.reference}`}
                breadcrumb={[{ label: "Mes contrats", to: "/my/contracts" }, { label: contract.reference }]}
            />

            {endingSoon && (
                <Alert tone="warning" title="Échéance proche" className="mb-4">
                    Ce contrat se termine dans {contract.days_remaining} jour{contract.days_remaining === 1 ? "" : "s"}. Contactez les ressources
                    humaines pour connaître la suite.
                </Alert>
            )}

            <Card title="Conditions" actions={<StatusBadge domain="contract" status={contract.status} />} className="mb-6">
                <DefinitionList
                    items={[
                        { label: "Type de contrat", value: contract.contract_type_name },
                        { label: "Poste", value: contract.position_title },
                        { label: "Début", value: formatDate(contract.start_date) },
                        { label: "Fin", value: contract.end_date ? formatDate(contract.end_date) : "Durée indéterminée" },
                        { label: "Date de signature", value: formatDate(contract.signed_date) },
                        { label: "Période d'essai", value: contract.probation_days ? `${contract.probation_days} jours` : "" },
                        { label: "Salaire de base", value: formatMoney(contract.base_salary, contract.currency) },
                    ]}
                />
            </Card>

            <Card title="Documents">
                {documents.error && <Alert tone="error">{documents.error.message}</Alert>}
                {!documents.data && documents.loading && <Skeleton className="h-16" />}
                {documents.data && documents.data.length === 0 && (
                    <EmptyState icon={FileText} title="Aucun document" description="Aucun document n'est rattaché à ce contrat." />
                )}
                {documents.data && documents.data.length > 0 && (
                    <ul className="divide-y-2 divide-ink border-2 border-ink">
                        {documents.data.map((document) => (
                            <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                                <div>
                                    <p className="font-bold">{document.title}</p>
                                    <p className="text-sm text-gray-dark">
                                        PDF · {formatFileSize(document.size)} · ajouté le {formatDate(document.created_at)}
                                    </p>
                                </div>
                                <Button size="sm" variant="secondary" onClick={() => void download(document)} leftIcon={<Download className="size-4" aria-hidden="true" />}>
                                    Télécharger
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </>
    );
}