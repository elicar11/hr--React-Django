import { useState } from "react";
import { Alert, Button, Modal, Select } from "@/components/ui";
import { notify } from "@/lib/notify";
import { initializeBalances } from "../services/leaveService";

function InitializeBody({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
    const currentYear = new Date().getFullYear();
    const [year, setYear] = useState(String(currentYear));
    const [busy, setBusy] = useState(false);

    async function run() {
        setBusy(true);
        try {
            const result = await initializeBalances(Number(year));
            notify.success(`${result.created} solde(s) créé(s) pour ${result.year}`, "Les soldes existants n'ont pas été modifiés.");
            onDone();
            onClose();
        } catch (error) {
            notify.error(error);
            setBusy(false);
        }
    }

    return (
        <>
            <div className="space-y-4 p-5">
                <Alert tone="info">
                    Crée, pour chaque employé en poste, le solde de l'année choisie avec l'<strong>allocation annuelle</strong> de chaque type
                    décompté d'un solde (les types sans allocation sont ignorés). Aucun prorata n'est appliqué, et les soldes existants sont conservés.
                </Alert>
                <Select label="Année" value={year} onChange={(event) => setYear(event.target.value)}>
                    {[currentYear - 1, currentYear, currentYear + 1].map((value) => (
                        <option key={value} value={value}>
                            {value}
                        </option>
                    ))}
                </Select>
            </div>
            <div className="flex flex-wrap justify-end gap-3 border-t-2 border-ink bg-gray-light p-4">
                <Button variant="secondary" onClick={onClose} disabled={busy}>
                    Annuler
                </Button>
                <Button onClick={() => void run()} loading={busy}>
                    Initialiser {year}
                </Button>
            </div>
        </>
    );
}

export function InitializeBalancesModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
    return (
        <Modal open={open} onClose={onClose} title="Initialiser les soldes d'une année" size="sm" padded={false}>
            <InitializeBody onClose={onClose} onDone={onDone} />
        </Modal>
    );
}