import { useState } from "react";
import { Button, ConfirmDialog, FileUpload } from "@/components/ui";
import { notify } from "@/lib/notify";
import { deleteEmployeePhoto, uploadEmployeePhoto } from "../services/employeeService";
import type { Employee } from "../types";
import { EmployeePhoto } from "./EmployeePhoto";

export function EmployeePhotoTab({ employee, onChanged }: { employee: Employee; onChanged: () => void }) {
    const [file, setFile] = useState<File | null>(null);
    const [inputKey, setInputKey] = useState(0); // remounts the file field after a save
    const [saving, setSaving] = useState(false);
    const [removing, setRemoving] = useState(false);
    const name = `${employee.first_name} ${employee.last_name}`;

    async function save() {
        if (!file) return;
        setSaving(true);
        try {
            await uploadEmployeePhoto(employee.id, file);
            notify.success("Photo enregistrée");
            setFile(null);
            setInputKey((current) => current + 1);
            onChanged();
        } catch (error) {
            notify.error(error); // wrong format, too heavy, too large...
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="grid gap-6 md:grid-cols-[auto_1fr]">
            <EmployeePhoto id={employee.id} hasPhoto={employee.has_photo} name={name} version={employee.updated_at} size="lg" />
            <div className="max-w-xl space-y-4">
                <FileUpload
                    key={inputKey}
                    label="Nouvelle photo"
                    accept=".jpg,.jpeg,.png,.webp"
                    maxSizeMb={2}
                    hint="JPEG, PNG ou WebP, 2 Mo et 4000 × 4000 pixels maximum."
                    file={file}
                    onChange={setFile}
                />
                <div className="flex flex-wrap gap-3">
                    <Button onClick={() => void save()} disabled={!file} loading={saving}>
                        Enregistrer la photo
                    </Button>
                    {employee.has_photo && (
                        <Button variant="danger" onClick={() => setRemoving(true)}>
                            Supprimer la photo
                        </Button>
                    )}
                </div>
            </div>

            <ConfirmDialog
                open={removing}
                onClose={() => setRemoving(false)}
                tone="danger"
                title="Supprimer la photo ?"
                message="La photo sera définitivement supprimée."
                confirmLabel="Supprimer"
                onConfirm={async () => {
                    await deleteEmployeePhoto(employee.id);
                    notify.success("Photo supprimée");
                    onChanged();
                }}
            />
        </div>
    );
}