import { CircleAlert, Search } from "lucide-react";
import { useId, useState } from "react";
import { Button, StatusBadge } from "@/components/ui";
import { controlClass } from "@/components/ui/fieldStyles";
import { cx } from "@/lib/cx";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { listEmployees } from "../services/employeeService";
import type { EmployeeListItem } from "../types";

export type PickedEmployee = Pick<
    EmployeeListItem,
    "id" | "matricule" | "first_name" | "last_name" | "employment_status"
>;

/** Search-and-pick an employee (the list can be too long for a plain <select>). */
export function EmployeePicker({
    label = "Employé",
    value,
    onChange,
    error,
    hint,
    required,
    disabled,
    excludeTerminated = true,
}: {
    label?: string;
    value: PickedEmployee | null;
    onChange: (employee: PickedEmployee | null) => void;
    error?: string;
    hint?: string;
    required?: boolean;
    disabled?: boolean;
    /** Employees who left cannot receive new contracts, leave requests... */
    excludeTerminated?: boolean;
}) {
    const id = useId();
    const [text, setText] = useState("");
    const term = useDebouncedValue(text.trim(), 300);
    const results = useApiQuery(["employee-picker", term], (signal) =>
        term.length < 2 ? Promise.resolve(null) : listEmployees({ search: term }, signal),
    );
    const items = results.data?.results ?? [];

    let status = "";
    if (term.length < 2) status = hint ?? "Tapez au moins 2 lettres du nom, du prénom ou du matricule.";
    else if (results.loading) status = "Recherche…";
    else if (items.length === 0) status = "Aucun employé trouvé.";
    else if (results.data && results.data.count > items.length) {
        status = `${results.data.count} résultats : affinez votre recherche.`;
    }

    return (
        <div className="space-y-1.5">
            <span id={`${id}-label`} className="block text-sm font-bold uppercase tracking-wide">
                {label}
                {required && <span aria-hidden="true"> *</span>}
            </span>

            {value ? (
                <div className="flex items-center justify-between gap-3 border-2 border-ink bg-paper px-3 py-2">
                    <span>
                        <strong>
                            {value.last_name} {value.first_name}
                        </strong>{" "}
                        · {value.matricule}
                    </span>
                    {!disabled && (
                        <Button size="sm" variant="secondary" onClick={() => onChange(null)}>
                            Changer
                        </Button>
                    )}
                </div>
            ) : (
                <div className="space-y-2">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2" aria-hidden="true" />
                        <input
                            id={id}
                            type="search"
                            value={text}
                            onChange={(event) => setText(event.target.value)}
                            aria-labelledby={`${id}-label`}
                            aria-describedby={`${id}-status`}
                            aria-invalid={error ? true : undefined}
                            disabled={disabled}
                            className={cx(controlClass(error), "pl-10")}
                        />
                    </div>
                    <p id={`${id}-status`} aria-live="polite" className="text-sm text-gray-dark">
                        {status}
                    </p>
                    {items.length > 0 && (
                        <ul className="max-h-64 divide-y-2 divide-ink overflow-y-auto border-2 border-ink bg-paper">
                            {items.map((employee) => {
                                const blocked = excludeTerminated && employee.employment_status === "TERMINATED";
                                return (
                                    <li key={employee.id}>
                                        <button
                                            type="button"
                                            disabled={blocked}
                                            onClick={() => {
                                                onChange(employee);
                                                setText("");
                                            }}
                                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-paper disabled:hover:text-ink"
                                        >
                                            <span>
                                                <strong>
                                                    {employee.last_name} {employee.first_name}
                                                </strong>{" "}
                                                · {employee.matricule}
                                            </span>
                                            <StatusBadge domain="employee" status={employee.employment_status} />
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}

            {error && (
                <p role="alert" className="flex items-start gap-1.5 text-sm font-bold text-danger">
                    <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    {error}
                </p>
            )}
        </div>
    );
}