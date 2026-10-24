import { X } from "lucide-react";
import { useId, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { useModalDialog } from "./useModalDialog";

const SIZES = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" } as const;

export interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    size?: keyof typeof SIZES;
    footer?: ReactNode;
    /** Set to false when `children` brings its own spacing. */
    padded?: boolean;
    children: ReactNode;
}

export function Modal({ open, onClose, title, description, size = "md", footer, padded = true, children }: ModalProps) {
    const titleId = useId();
    const descriptionId = useId();
    const dialogProps = useModalDialog(open, onClose);

    return (
        <dialog
            {...dialogProps}
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            className={cx(
                "m-auto max-h-[90dvh] w-[calc(100%-2rem)] border-2 border-ink bg-paper p-0 text-ink shadow-hard-lg backdrop:bg-ink/60",
                SIZES[size],
            )}
        >
            {/* Content is mounted only while open: its internal state resets on each opening. */}
            {open && (
                <div className="flex max-h-[90dvh] flex-col">
                    <header className="flex items-start justify-between gap-4 border-b-2 border-ink p-5">
                        <div>
                            <h2 id={titleId} className="text-2xl">
                                {title}
                            </h2>
                            {description && (
                                <p id={descriptionId} className="mt-1 text-sm text-gray-dark">
                                    {description}
                                </p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Fermer"
                            className="border-2 border-ink p-1 hover:bg-ink hover:text-paper"
                        >
                            <X className="size-5" aria-hidden="true" />
                        </button>
                    </header>
                    <div className={cx("overflow-y-auto", padded && "p-5")}>{children}</div>
                    {footer && (
                        <footer className="flex flex-wrap justify-end gap-3 border-t-2 border-ink bg-gray-light p-4">{footer}</footer>
                    )}
                </div>
            )}
        </dialog>
    );
}