import { cx } from "@/lib/cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
    "inline-flex items-center justify-center gap-2 border-2 font-bold uppercase tracking-wide " +
    "transition-transform select-none disabled:pointer-events-none disabled:opacity-50";
const LIFT =
    "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard " +
    "active:translate-x-0 active:translate-y-0 active:shadow-none";

const VARIANTS: Record<ButtonVariant, string> = {
    primary: `border-ink bg-ink text-paper hover:bg-paper hover:text-ink ${LIFT}`,
    secondary: `border-ink bg-paper text-ink hover:bg-ink hover:text-paper ${LIFT}`,
    ghost: "border-transparent bg-transparent text-ink hover:border-ink hover:bg-gray-light",
    danger: `border-danger bg-paper text-danger hover:bg-danger hover:text-paper ${LIFT}`,
};

const SIZES: Record<ButtonSize, string> = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
};

/** Also usable on <Link> and <a> to give them the look of a button. */
export function buttonStyles({
    variant = "primary",
    size = "md",
    className,
}: {
    variant?: ButtonVariant;
    size?: ButtonSize;
    className?: string;
} = {}) {
    return cx(BASE, VARIANTS[variant], SIZES[size], className);
}