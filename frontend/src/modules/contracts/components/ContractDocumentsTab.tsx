import { Download, FileText, Trash2 } from "lucide-react";
import { useState } from "react";
import { Alert, Button, Card, ConfirmDialog, EmptyState, FileUpload, Input, Skeleton } from "@/components/ui";
import { saveFile } from "@/lib/download";
import { formatDate, formatFileSize } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { notify } from "@/lib/notify";
import { useSession } from "@/modules/auth/sessionContext";
import {
    deleteContractDocument,
    downloadContractDocument,
    listContractDocuments,
    uploadContractDocument,
} from "../services/contractService";
import type { ContractDocument } from "../types";

export function ContractDocumentsTab({ contractId }: { contractId: number }) {
    const { user } = useSession();
    const [version, setVersion] = useState(0);
    const query = useApiQuery(["contract-documents", contractId, version], (signal) =>
        listContractDocuments(contractId, signal),
    );

    const [title, setTitle] = useState("");
    const [titleError, setTitleError] = useState<string>();
    const [file, setFile] = useState<File | null>(null);
    const [inputKey, setInputKey] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [deleting, setDeleting] = useState<ContractDocument | null>(null);

    async function upload() {
        if (!title.trim()) return setTitleError("Le titre est obligatoire.");
        if (!file) return;
        setUploading(true);
        try {
            await uploadContractDocument(contractId, title.trim(), file);
            notify.success("Document ajouté");
            setTitle("");
            setFile(null);
            setInputKey((current) => current + 1);
            setVersion((current) => current + 1);
        } catch (error) {
            notify.error(error); // not a PDF, too heavy...
        } finally {
            setUploading(false);
        }
    }

    async function download(document: ContractDocument) {
        try {
            saveFile(await downloadContractDocument(contractId, document.id));
        } catch (error) {
            notify.error(error);
        }
    }

    return (
        <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Documents">
                {query.error && <Alert tone="error">{query.error.message}</Alert>}
                {!query.data && query.loading && <Skeleton className="h-24" />}
                {query.data && query.data.length === 0 && (
                    <EmptyState icon={FileText} title="Aucun document" description="Ajoutez par exemple la copie signée du contrat." />
                )}
                {query.data && query.data.length > 0 && (
                    <ul className="divide-y-2 divide-ink border-2 border-ink">
                        {query.data.map((document) => (
                            <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                                <div>
                                    <p className="font-bold">{document.title}</p>
                                    <p className="text-sm text-gray-dark">
                                        PDF · {formatFileSize(document.size)} · ajouté le {formatDate(document.created_at)}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="secondary" onClick={() => void download(document)} leftIcon={<Download className="size-4" aria-hidden="true" />}>
                                        Télécharger
                                    </Button>
                                    {user.role === "ADMIN" && (
                                        <Button
                                            size="sm"
                                            variant="danger"
                                            aria-label={`Supprimer ${document.title}`}
                                            onClick={() => setDeleting(document)}
                                            leftIcon={<Trash2 className="size-4" aria-hidden="true" />}
                                        >
                                            Supprimer
                                        </Button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <Card title="Ajouter un document">
                <div className="space-y-4">
                    <Input
                        label="Titre"
                        required
                        value={title}
                        error={titleError}
                        onChange={(event) => {
                            setTitle(event.target.value);
                            setTitleError(undefined);
                        }}
                    />
                    <FileUpload key={inputKey} label="Fichier PDF" accept=".pdf" maxSizeMb={5} required file={file} onChange={setFile} />
                    <Button onClick={() => void upload()} disabled={!file} loading={uploading}>
                        Ajouter le document
                    </Button>
                </div>
            </Card>

            <ConfirmDialog
                open={deleting !== null}
                onClose={() => setDeleting(null)}
                tone="danger"
                title="Supprimer ce document ?"
                message={
                    <>
                        Le document <strong>{deleting?.title}</strong> sera définitivement supprimé.
                    </>
                }
                confirmLabel="Supprimer"
                onConfirm={async () => {
                    if (!deleting) return;
                    await deleteContractDocument(contractId, deleting.id);
                    notify.success("Document supprimé");
                    setVersion((current) => current + 1);
                }}
            />
        </div>
    );
}