import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { tr } from "@/i18n/translate";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";

/** Frame of the public pages: login, forgotten password, reset. */
export function AuthLayout({
    title,
    description,
    footer,
    children,
}: {
    title: string;
    description?: string;
    footer?: ReactNode;
    children: ReactNode;
}) {
    const { t } = useTranslation();
    useEffect(() => {
        document.title = `${tr(title)} · HR`;
    }, [title]);

    return (
        <main className="flex min-h-dvh items-center justify-center bg-gray-light p-4">
            <div className="w-full max-w-md space-y-6">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                    <span className="flex size-12 items-center justify-center border-2 border-ink bg-ink font-display text-2xl font-bold text-paper">
                        HR
                    </span>
                    <span className="font-display text-xl font-bold">{t("Ressources humaines")}</span>
                    </div>
                    <LanguageSwitcher />
                </div>
                <div className="border-2 border-ink bg-paper p-6 shadow-hard-lg">
                    <h1 className="text-3xl">{tr(title)}</h1>
                    {description && <p className="mt-2 text-gray-dark">{tr(description)}</p>}
                    <div className="mt-6 space-y-4">{children}</div>
                </div>
                {footer && <p className="text-center text-sm">{footer}</p>}
            </div>
        </main>
    );
}
