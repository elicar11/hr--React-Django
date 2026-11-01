import { useTranslation } from "react-i18next";
import { cx } from "@/lib/cx";
import { LANGUAGES, type Language } from "./index";

const NAMES: Record<Language, { short: string; name: string }> = {
    fr: { short: "FR", name: "Français" },
    en: { short: "EN", name: "English" },
};

/** Two-button language choice. Names are written in their own language and never translated. */
export function LanguageSwitcher({ className }: { className?: string }) {
    const { t, i18n } = useTranslation();
    return (
        <div role="group" aria-label={t("Langue")} className={cx("flex border-2 border-ink", className)}>
            {LANGUAGES.map((language) => {
                const active = i18n.language === language;
                return (
                    <button
                        key={language}
                        type="button"
                        lang={language}
                        onClick={() => void i18n.changeLanguage(language)}
                        aria-pressed={active}
                        aria-label={NAMES[language].name}
                        title={NAMES[language].name}
                        className={cx(
                            "px-2.5 py-1.5 text-xs font-bold",
                            active ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-gray-light",
                        )}
                    >
                        {NAMES[language].short}
                    </button>
                );
            })}
        </div>
    );
}