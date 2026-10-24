import type { ReactNode } from "react";

/** Label/value pairs of a detail page (employee sheet, contract, payslip...). */
export function DefinitionList({ items }: { items: { label: string; value: ReactNode }[] }) {
    return (
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {items.map((item) => (
                <div key={item.label}>
                    <dt className="text-xs font-bold uppercase tracking-widest text-gray-dark">{item.label}</dt>
                    <dd className="mt-1 text-base font-medium">{item.value || "—"}</dd>
                </div>
            ))}
        </dl>
    );
}