import type { LucideIcon } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { cx } from "@/lib/cx";

export interface TabItem {
    id: string;
    label: string;
    icon?: LucideIcon;
}

export function Tabs({
    idPrefix,
    label,
    items,
    value,
    onChange,
}: {
    /** Unique prefix, shared with the matching <TabPanel>s. */
    idPrefix: string;
    label: string;
    items: TabItem[];
    value: string;
    onChange: (id: string) => void;
}) {
    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        const index = items.findIndex((item) => item.id === value);
        const moves: Record<string, number> = {
            ArrowRight: index + 1,
            ArrowLeft: index - 1,
            Home: 0,
            End: items.length - 1,
        };
        const next = moves[event.key];
        if (next === undefined) return;
        event.preventDefault();
        const target = items[(next + items.length) % items.length];
        if (!target) return;
        onChange(target.id);
        document.getElementById(`${idPrefix}-tab-${target.id}`)?.focus();
    }

    return (
        <div
            role="tablist"
            aria-label={label}
            onKeyDown={handleKeyDown}
            className="flex flex-wrap gap-0 border-b-2 border-ink"
        >
            {items.map((item) => {
                const selected = item.id === value;
                const Icon = item.icon;
                return (
                    <button
                        key={item.id}
                        id={`${idPrefix}-tab-${item.id}`}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        aria-controls={`${idPrefix}-panel-${item.id}`}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => onChange(item.id)}
                        className={cx(
                            "-mb-0.5 flex items-center gap-2 border-2 px-4 py-2 text-sm font-bold uppercase tracking-wide",
                            selected ? "border-ink border-b-paper bg-paper" : "border-transparent hover:border-ink hover:bg-gray-light",
                        )}
                    >
                        {Icon && <Icon className="size-4" aria-hidden="true" />}
                        {item.label}
                    </button>
                );
            })}
        </div>
    );
}

export function TabPanel({
    idPrefix,
    id,
    active,
    children,
}: {
    idPrefix: string;
    id: string;
    active: boolean;
    children: ReactNode;
}) {
    return (
        <div
            role="tabpanel"
            id={`${idPrefix}-panel-${id}`}
            aria-labelledby={`${idPrefix}-tab-${id}`}
            hidden={!active}
            tabIndex={0}
            className="pt-5"
        >
            {active ? children : null}
        </div>
    );
}