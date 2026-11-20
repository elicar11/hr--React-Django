import type { ReactNode } from "react";
import i18n from "./index";
import { en } from "./locales/en";

const FRENCH_HINT = /[éèêëàâùûçôîï]|\b(le|la|les|de|des|du|un|une|et|ou|pour|sur|dans|avec|pas|est|sont|vous|votre)\b/i;
const missing = new Set<string>();

if (import.meta.env.DEV) {
    (window as unknown as { __i18nMissing: Set<string> }).__i18nMissing = missing;
}

/**
 * Translates a UI text when the dictionary knows it.
 * Any other text (user data, a sentence not translated yet, an English text) is returned unchanged.
 */
export function tr(text: string): string;
export function tr(text: string | undefined): string | undefined;
export function tr(text: string | undefined): string | undefined {
    if (!text) return text;
    if (i18n.exists(text)) return i18n.t(text);
    if (import.meta.env.DEV && i18n.language === "en" && FRENCH_HINT.test(text)) missing.add(text);
    return text;
}

/** Same, for a React node: only a plain string is translated. */
export function trNode(node: ReactNode): ReactNode {
    return typeof node === "string" ? tr(node) : node;
}

interface Template { regex: RegExp; key: string; names: string[] }
let templates: Template[] | null = null;
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function buildTemplates(): Template[] {
    const result: Template[] = [];
    for (const key of Object.keys(en)) {
        if (!key.includes("{{") || key.includes("<") || /_(one|other)$/.test(key)) continue;
        if (key.replace(/\{\{\w+\}\}/g, "").length < 12) continue;
        const names: string[] = [];
        const source = key.split(/(\{\{\w+\}\})/).map((part) => {
            const placeholder = /^\{\{(\w+)\}\}$/.exec(part);
            if (placeholder) { names.push(placeholder[1]); return "(.+?)"; }
            return escapeRegex(part);
        }).join("");
        result.push({ regex: new RegExp(`^${source}$`), key, names });
    }
    return result;
}

export function translateApiMessage(text: string): string {
    if (!text || i18n.language !== "en") return text;
    if (i18n.exists(text)) return i18n.t(text);
    templates ??= buildTemplates();
    for (const template of templates) {
        const match = template.regex.exec(text);
        if (!match) continue;
        const values: Record<string, string> = {};
        template.names.forEach((name, index) => { values[name] = tr(match[index + 1]) ?? ""; });
        return i18n.t(template.key, values);
    }
    if (import.meta.env.DEV && FRENCH_HINT.test(text)) missing.add(text);
    return text;
}
