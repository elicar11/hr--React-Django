import { useState } from "react";
import { Alert, Button, Modal } from "@/components/ui";
import { toApiError } from "@/lib/api";
import { notify } from "@/lib/notify";
import type { User } from "@/modules/auth/types";
import { EmployeePicker, type PickedEmployee } from "@/modules/employees/components/EmployeePicker";
import { updateEmployee } from "@/modules/employees/services/employeeService";

interface BodyProps {
    user: User;
    onClose: () => void;
    onSaved: () => void;
}

function LinkBody({ user, onClose, onSaved }: BodyProps) {
    const [employee, setEmployee] = useState<PickedEmployee | null>(null);
    const [error, setError] = useState<string>();
    const [busy, setBusy] = useState(false);

    async function link() {
        if (!employee) return setError("Choisissez un employé.");
        setBusy(true);
        setError(undefined);
        try {
            await updateEmployee(employee.id, { user: user.id });
            notify.success("Compte lié", `${user.email} → ${employee.last_name} ${employee.first_name}`);
            onSaved();
            onClose();
        } catch (failure) {
            setError(toApiError(failure).message); // e.g. "Ce compte utilisateur est déjà associé à un autre employé."
            setBusy(false);
        }
    }

    return (
        <>
            <div className="space-y-4 p-5">
                <p>
                    Lier le compte <strong>{user.email}</strong> à un dossier employé : l'utilisateur pourra alors consulter son propre dossier, ses
                    pointages, ses congés et ses bulletins.
                </p>
                <Alert tone="info">
                    Si l'employé était déjà lié à un autre compte, ce lien sera remplacé. Pour savoir si un employé a un compte, ouvrez sa fiche
                    (onglet « Général »).
                </Alert>
                <EmployeePicker required value={employee} onChange={(picked) => { setEmployee(picked); setError(undefined); }} error={error} />
            </div>
            <div className="flex flex-wrap justify-end gap-3 border-t-2 border-ink bg-gray-light p-4">
                <Button variant="secondary" onClick={onClose} disabled={busy}>
                    Annuler
                </Button>
                <Button onClick={() => void link()} loading={busy}>
                    Lier le compte
                </Button>
            </div>
        </>
    );
}

export function LinkEmployeeModal({ open, ...body }: BodyProps & { open: boolean }) {
    return (
        <Modal open={open} onClose={body.onClose} title="Lier à un employé" padded={false}>
            <LinkBody {...body} />
        </Modal>
    );
}