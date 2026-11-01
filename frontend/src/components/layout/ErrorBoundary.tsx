import { TriangleAlert } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { buttonStyles } from "@/components/ui/buttonStyles";
import i18n from "@/i18n";

interface State {
    failed: boolean;
}

/**
 * Catches rendering errors only. Errors of event handlers and API calls are handled where they happen
 * (notify.error, inline alerts). Plain <a> and window.location are used on purpose: this component
 * must keep working even if the router itself failed.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
    state: State = { failed: false };

    static getDerivedStateFromError(): State {
        return { failed: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        // No monitoring service is configured: the details stay in the browser console.
        console.error("Unhandled interface error", error, info.componentStack);
    }

    render() {
        if (!this.state.failed) return this.props.children;
        return (
            <div role="alert" className="mx-auto max-w-xl space-y-4 border-4 border-ink bg-paper p-8 shadow-hard">
                <TriangleAlert className="size-10" aria-hidden="true" />
                <h1 className="text-3xl">{i18n.t("Une erreur est survenue")}</h1>
                <p>
                    {i18n.t(
                        "Cette page n'a pas pu s'afficher. Vos données ne sont pas perdues : rechargez la page ou revenez à l'accueil. Si le problème persiste, contactez l'administrateur.",
                    )}
                </p>
                <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={() => window.location.reload()} className={buttonStyles()}>
                        {i18n.t("Recharger la page")}
                    </button>
                    <a href="/" className={buttonStyles({ variant: "secondary" })}>
                        {i18n.t("Retour à l'accueil")}
                    </a>
                </div>
            </div>
        );
    }
}