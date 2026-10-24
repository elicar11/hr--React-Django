import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export interface FieldShellProps {
    id: string;
    label: string;
    hint?: string;
    error?: string;
    required?: boolean;
    className?: string;
    children: ReactNode;
}

/** Label + control + hint/error, wired for screen readers. */
export function FieldShell({ id, label, hint, error, required, className, children }: FieldShellProps) {
    return (
        <div className={cx("space-y-1.5", className)}>
            <label htmlFor={id} className="block text-sm font-bold uppercase tracking-wide">
                {label}
                {required && <span aria-hidden="true"> *</span>}
            </label>
            {children}
            {hint && !error && (
                <p id={`${id}-hint`} className="text-sm text-gray-dark">
                    {hint}
                </p>
            )}
            {error && (
                <p id={`${id}-error`} role="alert" className="flex items-start gap-1.5 text-sm font-bold text-danger">
                    <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    {error}
                </p>
            )}
        </div>
    );
}