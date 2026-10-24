import { useEffect, useRef, type MouseEvent, type SyntheticEvent } from "react";

/**
 * Drives a native <dialog>: focus trap, Escape key and inert background come from the browser.
 * The parent owns the `open` state.
 */
export function useModalDialog(open: boolean, onClose: () => void) {
    const ref = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        if (open && !dialog.open) dialog.showModal();
        if (!open && dialog.open) dialog.close();
    }, [open]);

    useEffect(() => {
        if (!open) return;
        document.body.classList.add("overflow-hidden");
        return () => document.body.classList.remove("overflow-hidden");
    }, [open]);

    return {
        ref,
        onCancel: (event: SyntheticEvent<HTMLDialogElement>) => {
            event.preventDefault(); // the parent decides: it sets open=false
            onClose();
        },
        // The browser may close the dialog by itself (second Escape press): keep the parent in sync.
        onClose: () => {
            if (open) onClose();
        },
        // A click on the backdrop targets the <dialog> element itself.
        onClick: (event: MouseEvent<HTMLDialogElement>) => {
            if (event.target === event.currentTarget) onClose();
        },
    };
}