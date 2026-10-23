import { Link } from "react-router";

export function NotFoundPage() {
    return (
        <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 p-6">
            <p className="font-display text-8xl font-bold">404</p>
            <h1 className="text-3xl">Page introuvable</h1>
            <p className="text-gray-dark">La page demandée n'existe pas ou a été déplacée.</p>
            <Link
                to="/"
                className="w-fit border-2 border-ink bg-ink px-4 py-2 font-bold uppercase tracking-wide text-paper hover:bg-paper hover:text-ink"
            >
                Retour à l'accueil
            </Link>
        </main>
    );
}