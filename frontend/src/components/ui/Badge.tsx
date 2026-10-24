import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/** Tones differ by shape and contrast (solid, outlined, dashed, struck), never by hue alone. */
export type BadgeTone = "solid" | "outline" | "dashed" | "muted" | "struck" | "alert";

const TONES: Record<BadgeTone, string> = {
    solid: "border-ink bg-ink text-paper",
    outline: "border-ink bg-paper text-ink",
    dashed: "border-dashed border-ink bg-paper text-ink",
    muted: "border-gray-dark bg-gray-light text-gray-dark",
    struck: "border-gray-dark bg-gray-light text-gray-dark line-through",
    alert: "border-danger bg-paper text-danger",
};

export function Badge({
    tone = "outline",
    icon: Icon,
    children,
}: {
    tone?: BadgeTone;
    icon?: LucideIcon;
    children: ReactNode;
}) {
    return (
        <span
            className={cx(
                "inline-flex items-center gap-1 whitespace-nowrap border-2 px-2 py-0.5 text-xs font-bold uppercase tracking-wide",
                TONES[tone],
            )}
        >
            {Icon && <Icon className="size-3.5" aria-hidden="true" />}
            {children}
        </span>
    );
}