import { useId, useRef, type ReactNode } from "react";
import { cx } from "@/lib/cx";

export interface PopoverProps {
    /** Accessible name of the button and of the panel. */
    label: string;
    /** Visible content of the button. */
    trigger: ReactNode;
    align?: "start" | "end";
    role?: "menu" | "dialog";
    triggerClassName?: string;
    panelClassName?: string;
    /** Called when the panel opens (to move the focus inside). */
    onOpen?: (panel: HTMLElement) => void;
    children: ReactNode | ((close: () => void) => ReactNode);
}

/**
 * Button + panel using the native Popover API: the panel lives in the top layer, so it is never
 * clipped by a scrolling table, and closes on outside click or Escape.
 */
export function Popover({
    label,
    trigger,
    align = "start",
    role = "dialog",
    triggerClassName,
    panelClassName,
    onOpen,
    children,
}: PopoverProps) {
    const id = useId();
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    function close() {
        panelRef.current?.hidePopover();
        triggerRef.current?.focus();
    }

    function place() {
        const button = triggerRef.current;
        const panel = panelRef.current;
        if (!button || !panel) return;
        const rect = button.getBoundingClientRect();
        const left = align === "end" ? rect.right - panel.offsetWidth : rect.left;
        panel.style.top = `${rect.bottom + 8}px`;
        panel.style.left = `${Math.min(Math.max(8, left), window.innerWidth - panel.offsetWidth - 8)}px`;
    }

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                popoverTarget={id}
                aria-haspopup={role}
                aria-label={label}
                className={triggerClassName}
            >
                {trigger}
            </button>
            <div
                ref={panelRef}
                id={id}
                popover="auto"
                role={role}
                aria-label={label}
                onToggle={(event) => {
                    if (event.newState !== "open") return;
                    place();
                    if (panelRef.current) onOpen?.(panelRef.current);
                }}
                className={cx("m-0 inset-auto min-w-48 border-2 border-ink bg-paper p-0 text-ink shadow-hard", panelClassName)}
            >
                {typeof children === "function" ? children(close) : children}
            </div>
        </>
    );
}