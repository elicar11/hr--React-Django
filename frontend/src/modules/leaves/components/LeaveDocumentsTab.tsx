import { Download, FileText, Trash2 } from "lucide-react";
import { useState } from "react";
import { Alert, Button, Card, ConfirmDialog, EmptyState, FileUpload, Input, Skeleton } from "@/components/ui";
import { saveFile } from "@/lib/download";
import { formatDate, formatFileSize } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { notify } from "@/lib/notify";
import {
    deleteLeaveDocument,
    downloadLeaveDocument,
    listLeaveDocuments,
    uploadLeaveDocument,
} from "../services/leaveService";
import type { LeaveDocument, LeaveStatus } from "../types";

export function LeaveDocumentsTab({ leaveId, status }: { leaveId: number; status: LeaveStatus }) {
    const [version, setVersion] = useState(0);
    const query = useApiQuery(["leave-documents", leaveId, version], (signal) => listLeaveDocuments(leaveId, signal));
    const [title, setTitle] = useState("");
    const [titleError, setTitleError] = useState<string>();
    const [file, setFile] = useState<File | null>(null);
    const [inputKey, setInputKey] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [deleting, setDeleting] = useState<LeaveDocument | null>(null);
    const canUpload = status === "PENDING" || status === "APPROVED";

    async function upload() {
        if (!title.trim()) return setTitleError("Le titre est obligatoire.");
        if (!file) return;
        setUploading(true);
        try {
            await uploadLeaveDocument(leaveId, title.trim(), file);
            notify.success("Justificatif ajouté");
            setTitle("");
            setFile(null);
            setInputKey((current) => current + 1);
            setVersion((current) => current + 1);
        } catch (error) {
            notify.error(error); // wrong format, too heavy...
        } finally {
            setUploading(false);
        }
    }

    async function download(document: LeaveDocument) {
        try {
            saveFile(await downloadLeaveDocument(leaveId, document.id));
        } catch (error) {
            notify.error(error);
        }
    }

    return (
        <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Justificatifs">
                {query.error && <Alert tone="error">{query.error.message}</Alert>}
                {!query.data && query.loading && <Skeleton className="h-24" />}
                {query.data && query.data.length === 0 && (
                    <EmptyState icon={FileText} title="Aucun justificatif" description="Ajoutez par exemple un certificat ou un document officiel." />
                )}
                {query.data && query.data.length > 0 && (
                    <ul className="divide-y-2 divide-ink border-2 border-ink">
                        {query.data.map((document) => (
                            <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                                <div>
                                    <p className="font-bold">{document.title}</p>
                                    <p className="text-sm text-gray-dark">
                                        {formatFileSize(document.size)} · ajouté le {formatDate(document.created_at)}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="secondary" onClick={() => void download(document)} leftIcon={<Download className="size-4" aria-hidden="true" />}>
                                        Télécharger
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="danger"
                                        aria-label={`Retirer ${document.title}`}
                                        onClick={() => setDeleting(document)}
                                        leftIcon={<Trash2 className="size-4" aria-hidden="true" />}
                                    >
                                        Retirer
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            {canUpload && (
                <Card title="Ajouter un justificatif">
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
                        <FileUpload key={inputKey} label="Fichier" accept=".pdf,.jpg,.jpeg,.png" maxSizeMb={5} required file={file} onChange={setFile} />
                        <Button onClick={() => void upload()} disabled={!file} loading={uploading}>
                            Ajouter
                        </Button>
                    </div>
                </Card>
            )}

            <ConfirmDialog
                open={deleting !== null}
                onClose={() => setDeleting(null)}
                tone="danger"
                title="Retirer ce justificatif ?"
                message={
                    <>
                        Le justificatif <strong>{deleting?.title}</strong> sera supprimé. Après décision, seuls les RH peuvent le faire.
                    </>
                }
                confirmLabel="Retirer"
                onConfirm={async () => {
                    if (!deleting) return;
                    await deleteLeaveDocument(leaveId, deleting.id);
                    notify.success("Justificatif retiré");
                    setVersion((current) => current + 1);
                }}
            />
        </div>
    );
}