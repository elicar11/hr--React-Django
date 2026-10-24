import { Check, CircleAlert } from "lucide-react";
import { useId, type ComponentProps } from "react";
import { cx } from "@/lib/cx";
import { describedBy } from "./fieldStyles";

export interface CheckboxProps extends Omit<ComponentProps<"input">, "id" | "type"> {
    id?: string;
    label: string;
    hint?: string;
    error?: string;
}

export function Checkbox({ id, label, hint, error, className, ...props }: CheckboxProps) {
    const autoId = useId();
    const fieldId = id ?? autoId;
    return (
        <div className={cx("space-y-1", className)}>
            <label htmlFor={fieldId} className="flex cursor-pointer items-start gap-3">
                <input
                    id={fieldId}
                    type="checkbox"
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy(fieldId, hint, error)}
                    className="peer sr-only"
                    {...props}
                />
                <span
                    aria-hidden="true"
                    className={cx(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center border-2 bg-paper",
                        "peer-checked:bg-ink peer-checked:[&>svg]:opacity-100",
                        "peer-focus-visible:outline-solid peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2",
                        "peer-disabled:opacity-50",
                        error ? "border-danger" : "border-ink",
                    )}
                >
                    <Check className="size-4 text-paper opacity-0" />
                </span>
                <span className="font-medium">{label}</span>
            </label>
            {hint && !error && (
                <p id={`${fieldId}-hint`} className="pl-8 text-sm text-gray-dark">
                    {hint}
                </p>
            )}
            {error && (
                <p id={`${fieldId}-error`} role="alert" className="flex items-start gap-1.5 pl-8 text-sm font-bold text-danger">
                    <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    {error}
                </p>
            )}
        </div>
    );
}