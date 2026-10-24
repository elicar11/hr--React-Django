import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type ComponentProps } from "react";
import { cx } from "@/lib/cx";
import { FieldShell } from "./FieldShell";
import { controlClass, describedBy } from "./fieldStyles";

export interface PasswordFieldProps extends Omit<ComponentProps<"input">, "id" | "type"> {
    id?: string;
    label: string;
    hint?: string;
    error?: string;
}

/** Password input with a show/hide toggle. Set `autoComplete` ("current-password" / "new-password"). */
export function PasswordField({ id, label, hint, error, required, className, ...props }: PasswordFieldProps) {
    const autoId = useId();
    const fieldId = id ?? autoId;
    const [visible, setVisible] = useState(false);

    return (
        <FieldShell id={fieldId} label={label} hint={hint} error={error} required={required} className={className}>
            <div className="relative">
                <input
                    id={fieldId}
                    type={visible ? "text" : "password"}
                    aria-invalid={error ? true : undefined}
                    aria-required={required || undefined}
                    aria-describedby={describedBy(fieldId, hint, error)}
                    className={cx(controlClass(error), "pr-12")}
                    {...props}
                />
                <button
                    type="button"
                    onClick={() => setVisible((current) => !current)}
                    aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    aria-pressed={visible}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-ink hover:text-paper"
                >
                    {visible ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
                </button>
            </div>
        </FieldShell>
    );
}