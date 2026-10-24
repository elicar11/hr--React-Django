import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export type AlertTone = "info" | "success" | "warning" | "error";

const TONES: Record<AlertTone, { icon: LucideIcon; classes: string; role: "status" | "alert" }> = {
    info: { icon: Info, classes: "border-2 border-ink bg-paper", role: "status" },
    success: { icon: CircleCheck, classes: "border-2 border-ink bg-paper", role: "status" },
    // Warnings: thicker frame and gray background (shape and contrast, not hue).
    warning: { icon: TriangleAlert, classes: "border-4 border-ink bg-gray-light", role: "status" },
    error: { icon: CircleAlert, classes: "border-2 border-danger bg-paper text-danger", role: "alert" },
};

export function Alert({
    tone = "info",
    title,
    children,
    className,
}: {
    tone?: AlertTone;
    title?: string;
    children?: ReactNode;
    className?: string;
}) {
    const { icon: Icon, classes, role } = TONES[tone];
    return (
        <div role={role} className={cx("flex items-start gap-3 p-4", classes, className)}>
            <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div className="space-y-1">
                {title && <p className="font-bold uppercase tracking-wide">{title}</p>}
                {children && <div className="text-sm">{children}</div>}
            </div>
        </div>
    );
}