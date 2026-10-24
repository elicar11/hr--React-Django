import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Shown instead of an empty list. Always propose a useful action when there is one. */
export function EmptyState({
    title,
    description,
    icon: Icon = Inbox,
    action,
}: {
    title: string;
    description?: string;
    icon?: LucideIcon;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-col items-center gap-4 border-2 border-dashed border-ink bg-paper p-10 text-center">
            <span className="flex size-14 items-center justify-center border-2 border-ink bg-gray-light">
                <Icon className="size-7" aria-hidden="true" />
            </span>
            <div className="space-y-1">
                <h2 className="text-2xl">{title}</h2>
                {description && <p className="mx-auto max-w-md text-gray-dark">{description}</p>}
            </div>
            {action}
        </div>
    );
}