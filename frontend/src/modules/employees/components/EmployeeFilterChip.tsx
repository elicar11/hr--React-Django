import { X } from "lucide-react";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { getEmployee } from "../services/employeeService";

/** Shows the employee a list is filtered on (`?employee=ID`), with a button to remove the filter. */
export function EmployeeFilterChip({ employeeId, onClear }: { employeeId: number; onClear: () => void }) {
    const query = useApiQuery(["employee-chip", employeeId], (signal) => getEmployee(employeeId, signal));
    const name = query.data ? `${query.data.last_name} ${query.data.first_name}` : `n° ${employeeId}`;
    return (
        <div className="flex items-center gap-2 border-2 border-ink bg-paper px-3 py-1.5 text-sm">
            <span>
                Employé : <strong>{name}</strong>
            </span>
            <button
                type="button"
                onClick={onClear}
                aria-label="Retirer le filtre sur l'employé"
                className="p-0.5 hover:bg-ink hover:text-paper"
            >
                <X className="size-4" aria-hidden="true" />
            </button>
        </div>
    );
}