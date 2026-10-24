import type { ComponentProps, ReactNode } from "react";
import { buttonStyles, type ButtonSize, type ButtonVariant } from "./buttonStyles";
import { Spinner } from "./Spinner";

export interface ButtonProps extends ComponentProps<"button"> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    leftIcon?: ReactNode;
}

export function Button({
    variant = "primary",
    size = "md",
    loading = false,
    leftIcon,
    type = "button", // never submits a form by accident
    disabled,
    className,
    children,
    ...props
}: ButtonProps) {
    return (
        <button
            type={type}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            className={buttonStyles({ variant, size, className })}
            {...props}
        >
            {loading ? <Spinner size="sm" label="Chargement" /> : leftIcon}
            {children}
        </button>
    );
}