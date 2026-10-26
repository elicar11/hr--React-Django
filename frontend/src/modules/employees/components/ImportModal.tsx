import { Download } from "lucide-react";
import { useState } from "react";
import { Alert, Button, FileUpload, Modal } from "@/components/ui";
import { saveFile } from "@/lib/download";
import { notify } from "@/lib/notify";
import { toApiError } from "@/lib/api";
import { downloadImportTemplate, importEmployees } from "../services/employeeService";
import type { ImportPreview, ImportRowError } from "../types";

function RowErrors({ errors }: { errors: ImportRowError[] }) {
    return (
        <div className="max-h-64 overflow-y-auto border-2 border-ink">
            <table className="w-full border-collapse text-left text-sm">
                <caption className="sr-only">Erreurs du fichier, ligne par ligne</caption>
                <thead className="sticky top-0 bg-ink text-paper">
                    <tr>
                        <th scope="col" className="px-3 py-2">Ligne</th>
                        <th scope="col" className="px-3 py-2">Problèmes</th>
                    </tr>
                </thead>
                <tbody>
                    {errors.map((row) => (
                        <tr key={row.line} className="border-t-2 border-ink align-top">
                            <td className="px-3 py-2 font-bold">{row.line}</td>
                            <td className="px-3 py-2">
                                <ul className="space-y-0.5">
                                    {Object.entries(row.errors).map(([column, messages]) => (
                                        <li key={column}>
                                            <strong>{column}</strong> : {messages.join(" ")}
                                        </li>
                                    ))}
                                </ul>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function ImportBody({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<ImportPreview | null>(null);
    const [busy, setBusy] = useState<"check" | "import" | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function check() {
        if (!file) return;
        setBusy("check");
        setError(null);
        try {
            setPreview(await importEmployees(file, true));
        } catch (failure) {
            setPreview(null);
            setError(toApiError(failure).message);
        } finally {
            setBusy(null);
        }
    }

    async function runImport() {
        if (!file) return;
        setBusy("import");
        setError(null);
        try {
            const result = await importEmployees(file, false);
            notify.success(`${result.created} employé(s) importé(s)`);
            onImported();
            onClose();
        } catch (failure) {
            const apiError = toApiError(failure);
            const details = apiError.details as { errors?: ImportRowError[] } | undefined;
            if (details?.errors?.length) {
                setPreview({ dry_run: true, rows: 0, valid: false, invalid_rows: details.errors.length, errors: details.errors, ignored_columns: [] });
            } else {
                setError(apiError.message);
            }
            setBusy(null);
        }
    }

    async function downloadTemplate() {
        try {
            saveFile(await downloadImportTemplate());
        } catch (failure) {
            notify.error(failure);
        }
    }

    return (
        <>
            <div className="space-y-4 p-5">
                <p className="text-sm">
                    Fichier CSV (UTF-8, séparateur « ; » ou « , »), 1 000 lignes et 1 Mo maximum, dates au format AAAA-MM-JJ.
                    L'import <strong>crée</strong> des employés : il ne modifie pas les fiches existantes. Il est tout ou rien.
                </p>
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void downloadTemplate()}
                    leftIcon={<Download className="size-4" aria-hidden="true" />}
                >
                    Télécharger le modèle
                </Button>
                <FileUpload
                    label="Fichier à importer"
                    accept=".csv"
                    maxSizeMb={1}
                    file={file}
                    onChange={(selected) => {
                        setFile(selected);
                        setPreview(null);
                        setError(null);
                    }}
                />
                {error && <Alert tone="error">{error}</Alert>}
                {preview?.valid && (
                    <Alert tone="success" title="Fichier valide">
                        {preview.rows} ligne(s) prête(s) à être importée(s). Aucun employé n'a encore été créé.
                        {preview.ignored_columns.length > 0 && ` Colonnes ignorées : ${preview.ignored_columns.join(", ")}.`}
                    </Alert>
                )}
                {preview && !preview.valid && (
                    <div className="space-y-2">
                        <Alert tone="error" title="Fichier refusé">
                            {preview.invalid_rows} ligne(s) invalide(s). Corrigez le fichier puis vérifiez-le à nouveau.
                            {preview.errors.length < preview.invalid_rows && ` Seules les ${preview.errors.length} premières sont listées.`}
                        </Alert>
                        <RowErrors errors={preview.errors} />
                    </div>
                )}
            </div>
            <div className="flex flex-wrap justify-end gap-3 border-t-2 border-ink bg-gray-light p-4">
                <Button variant="secondary" onClick={onClose} disabled={busy !== null}>
                    Fermer
                </Button>
                <Button variant="secondary" onClick={() => void check()} disabled={!file || busy === "import"} loading={busy === "check"}>
                    Vérifier le fichier
                </Button>
                {preview?.valid && (
                    <Button onClick={() => void runImport()} loading={busy === "import"}>
                        Importer {preview.rows} employé(s)
                    </Button>
                )}
            </div>
        </>
    );
}

export function ImportModal({
    open,
    onClose,
    onImported,
}: {
    open: boolean;
    onClose: () => void;
    onImported: () => void;
}) {
    return (
        <Modal open={open} onClose={onClose} title="Importer des employés" size="lg" padded={false}>
            <ImportBody onClose={onClose} onImported={onImported} />
        </Modal>
    );
}