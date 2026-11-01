import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./locales/en";
import { fr } from "./locales/fr";

export const LANGUAGES = ["fr", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

const STORAGE_KEY = "hr.language";

function isLanguage(value: unknown): value is Language {
    return value === "fr" || value === "en";
}

/** Saved choice first, then the browser language, French by default. */
function initialLanguage(): Language {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (isLanguage(stored)) return stored;
    } catch {
        /* storage unavailable: fall back to the browser language */
    }
    return navigator.language.toLowerCase().startsWith("en") ? "en" : "fr";
}

const reported = new Set<string>();

// French is the source text: the French sentence is the key, English is looked up in `en`.
// `fr` only holds the plural forms that French needs (see the conventions in the I1 notes).
void i18n.use(initReactI18next).init({
    resources: { fr: { translation: fr }, en: { translation: en } },
    lng: initialLanguage(),
    fallbackLng: false,
    // Keys are sentences: they contain "." and ":" which must not be read as separators.
    keySeparator: false,
    nsSeparator: false,
    returnEmptyString: false,
    interpolation: { escapeValue: false }, // React already escapes
    react: { useSuspense: false },
    saveMissing: import.meta.env.DEV,
    missingKeyHandler: (languages, _namespace, key) => {
        if (!languages.includes("en") || reported.has(key)) return;
        reported.add(key);
        console.warn(`[i18n] missing English translation: ${JSON.stringify(key)}`);
    },
});

document.documentElement.lang = i18n.language;
i18n.on("languageChanged", (language) => {
    document.documentElement.lang = language;
    try {
        localStorage.setItem(STORAGE_KEY, language);
    } catch {
        /* storage unavailable: the choice only lasts for this session */
    }
});

export default i18n;