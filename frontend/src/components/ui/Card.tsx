import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export function Card({
    title,
    description,
    actions,
    tone = "paper",
    className,
    children,
}: {
    title?: string;
    description?: string;
    actions?: ReactNode;
    tone?: "paper" | "muted";
    className?: string;
    children: ReactNode;
}) {
    return (
        <section className={cx("border-2 border-ink shadow-hard", tone === "muted" ? "bg-gray-light" : "bg-paper", className)}>
            {(title || actions) && (
                <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink px-5 py-4">
                    <div>
                        {title && <h2 className="text-xl">{title}</h2>}
                        {description && <p className="text-sm text-gray-dark">{description}</p>}
                    </div>
                    {actions}
                </header>
            )}
            <div className="p-5">{children}</div>
        </section>
    );
}