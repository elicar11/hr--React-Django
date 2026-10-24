import { useId, type ComponentProps } from "react";
import { FieldShell } from "./FieldShell";
import { controlClass, describedBy } from "./fieldStyles";

export interface InputProps extends Omit<ComponentProps<"input">, "id"> {
    id?: string;
    label: string;
    hint?: string;
    error?: string;
}

/** Works with react-hook-form: `<Input label="..." error={...} {...register("field")} />`. */
export function Input({ id, label, hint, error, required, className, ...props }: InputProps) {
    const autoId = useId();
    const fieldId = id ?? autoId;
    return (
        <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required} className={className}>
            <input
                id={fieldId}
                aria-invalid={error ? true : undefined}
                aria-required={required || undefined}
                aria-describedby={describedBy(fieldId, hint, error)}
                className={controlClass(error)}
                {...props}
            />
        </FieldShell>
    );
}

export function DateField(props: Omit<InputProps, "type">) {
    return <Input type="date" {...props} />;
}