import type { LucideIcon } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { Link } from "react-router";
import { cx } from "@/lib/cx";
import { Popover } from "./Popover";

export interface MenuItem {
    label: string;
    icon?: LucideIcon;
    onSelect?: () => void;
    /** Internal link (react-router). */
    to?: string;
    tone?: "default" | "danger";
    disabled?: boolean;
    separatorBefore?: boolean;
}

const ITEM_SELECTOR = '[role="menuitem"]:not([disabled])';
const ITEM_CLASS =
    "flex w-full items-center gap-3 px-4 py-2 text-left text-sm font-bold hover:bg-ink hover:text-paper focus-visible:bg-ink focus-visible:text-paper disabled:opacity-50";

function handleKeys(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(ITEM_SELECTOR));
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    const targets: Record<string, number> = {
        ArrowDown: index + 1,
        ArrowUp: index - 1,
        Home: 0,
        End: items.length - 1,
    };
    const next = targets[event.key];
    if (next === undefined) return;
    event.preventDefault();
    items[(next + items.length) % items.length]?.focus();
}

export function Menu({
    label,
    trigger,
    items,
    align = "start",
    triggerClassName,
}: {
    label: string;
    trigger: ReactNode;
    items: MenuItem[];
    align?: "start" | "end";
    triggerClassName?: string;
}) {
    return (
        <Popover
            label={label}
            role="menu"
            align={align}
            trigger={trigger}
            triggerClassName={triggerClassName}
            onOpen={(panel) => panel.querySelector<HTMLElement>(ITEM_SELECTOR)?.focus()}
        >
            {(close) => (
                <div className="py-1" onKeyDown={handleKeys}>
                    {items.map((item) => {
                        const Icon = item.icon;
                        const className = cx(ITEM_CLASS, item.tone === "danger" && "text-danger");
                        const content = (
                            <>
                                {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
                                {item.label}
                            </>
                        );
                        return (
                            <div key={item.label}>
                                {item.separatorBefore && <div role="separator" className="my-1 border-t-2 border-ink" />}
                                {item.to ? (
                                    <Link role="menuitem" to={item.to} onClick={close} className={className}>
                                        {content}
                                    </Link>
                                ) : (
                                    <button
                                        type="button"
                                        role="menuitem"
                                        disabled={item.disabled}
                                        className={className}
                                        onClick={() => {
                                            close();
                                            item.onSelect?.();
                                        }}
                                    >
                                        {content}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </Popover>
    );
}