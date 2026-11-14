import type { ReactNode } from "react";
import i18n from "./index";

/**
 * Translates a UI text when the dictionary knows it.
 * Any other text (user data, a sentence not translated yet, an English text) is returned unchanged.
 */
export function tr(text: string): string;
export function tr(text: string | undefined): string | undefined;
export function tr(text: string | undefined): string | undefined {
    if (!text) return text;
    return i18n.exists(text) ? i18n.t(text) : text;
}

/** Same, for a React node: only a plain string is translated. */
export function trNode(node: ReactNode): ReactNode {
    return typeof node === "string" ? tr(node) : node;
}