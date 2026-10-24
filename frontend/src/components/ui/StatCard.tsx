import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { cx } from "@/lib/cx";
import { Skeleton } from "./Skeleton";

export function StatCard({
    label,
    value,
    hint,
    icon: Icon,
    to,
    loading = false,
}: {
    label: string;
    value: ReactNode;
    hint?: string;
    icon?: LucideIcon;
    to?: string;
    loading?: boolean;
}) {
    const content = (
        <>
            <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-bold uppercase tracking-wide">{label}</p>
                {Icon && <Icon className="size-6 shrink-0" aria-hidden="true" />}
            </div>
            <div className="mt-3 font-display text-5xl font-bold leading-none">
                {loading ? <Skeleton className="h-12 w-24" /> : value}
            </div>
            {hint && <p className="mt-2 text-sm text-gray-dark">{hint}</p>}
        </>
    );
    const base = "block border-2 border-ink bg-paper p-5 shadow-hard";

    return to ? (
        <Link
            to={to}
            aria-busy={loading || undefined}
            className={cx(base, "transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg")}
        >
            {content}
        </Link>
    ) : (
        <div aria-busy={loading || undefined} className={base}>
            {content}
        </div>
    );
}