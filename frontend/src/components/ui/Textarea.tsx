import { useId, type ComponentProps } from "react";
import { FieldShell } from "./FieldShell";
import { controlClass, describedBy } from "./fieldStyles";

export interface TextareaProps extends Omit<ComponentProps<"textarea">, "id"> {
    id?: string;
    label: string;
    hint?: string;
    error?: string;
}

export function Textarea({ id, label, hint, error, required, className, rows = 4, ...props }: TextareaProps) {
    const autoId = useId();
    const fieldId = id ?? autoId;
    return (
        <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required} className={className}>
            <textarea
                id={fieldId}
                rows={rows}
                aria-invalid={error ? true : undefined}
                aria-required={required || undefined}
                aria-describedby={describedBy(fieldId, hint, error)}
                className={controlClass(error)}
                {...props}
            />
        </FieldShell>
    );
}