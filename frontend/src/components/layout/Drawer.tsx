import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useModalDialog } from "@/components/ui/useModalDialog";

/** Off-canvas menu for small screens (native <dialog>: focus trap and Escape included). */
export function Drawer({
    open,
    onClose,
    label,
    children,
}: {
    open: boolean;
    onClose: () => void;
    label: string;
    children: ReactNode;
}) {
    const dialogProps = useModalDialog(open, onClose);
    return (
        <dialog
            {...dialogProps}
            aria-label={label}
            className="m-0 mr-auto h-dvh max-h-none w-72 max-w-[85vw] border-0 border-r-2 border-paper bg-ink p-0 text-paper backdrop:bg-ink/60"
        >
            {open && (
                <div className="relative h-full">
                    {children}
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Fermer le menu"
                        className="absolute right-2 top-3 border-2 border-paper p-1 hover:bg-paper hover:text-ink focus-visible:outline-paper"
                    >
                        <X className="size-5" aria-hidden="true" />
                    </button>
                </div>
            )}
        </dialog>
    );
}