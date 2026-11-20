import type { ReactNode } from "react";
import { tr } from "@/i18n/translate";

/** Clearly separated block of a form. Fields are laid out in a responsive grid. */
export function FormSection({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: ReactNode;
}) {
    return (
        <fieldset className="border-2 border-ink bg-paper p-5">
            <legend className="border-2 border-ink bg-ink px-3 py-1 font-display text-lg font-bold text-paper">
                {tr(title)}
            </legend>
            {description && <p className="mb-4 text-sm text-gray-dark">{tr(description)}</p>}
            <div className="grid gap-4 md:grid-cols-2">{children}</div>
        </fieldset>
    );
}
