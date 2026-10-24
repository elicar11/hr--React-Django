import { ChevronDown } from "lucide-react";
import { useId, type ComponentProps } from "react";
import { cx } from "@/lib/cx";
import { FieldShell } from "./FieldShell";
import { controlClass, describedBy } from "./fieldStyles";

export interface SelectProps extends Omit<ComponentProps<"select">, "id"> {
    id?: string;
    label: string;
    hint?: string;
    error?: string;
    /** Text of the empty option (value ""). Omit it when a value is always required. */
    placeholder?: string;
}

export function Select({
    id,
    label,
    hint,
    error,
    required,
    className,
    placeholder,
    children,
    ...props
}: SelectProps) {
    const autoId = useId();
    const fieldId = id ?? autoId;
    return (
        <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required} className={className}>
            <div className="relative">
                <select
                    id={fieldId}
                    aria-invalid={error ? true : undefined}
                    aria-required={required || undefined}
                    aria-describedby={describedBy(fieldId, hint, error)}
                    className={cx(controlClass(error), "appearance-none pr-10")}
                    {...props}
                >
                    {placeholder !== undefined && <option value="">{placeholder}</option>}
                    {children}
                </select>
                <ChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2"
                    aria-hidden="true"
                />
            </div>
        </FieldShell>
    );
}