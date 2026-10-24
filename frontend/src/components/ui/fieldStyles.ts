import { cx } from "@/lib/cx";

/** Shared look of text inputs, selects and textareas. */
export function controlClass(error?: string) {
    return cx(
        "w-full border-2 bg-paper px-3 py-2 text-base placeholder:text-gray-dark/70 focus:shadow-hard-sm",
        "disabled:bg-gray-light disabled:text-gray-dark",
        error ? "border-danger" : "border-ink",
    );
}

/** id of the hint or error element describing a control (aria-describedby). */
export function describedBy(id: string, hint?: string, error?: string) {
    if (error) return `${id}-error`;
    if (hint) return `${id}-hint`;
    return undefined;
}