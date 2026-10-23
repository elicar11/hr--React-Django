import { useState } from "react";
import { toast } from "sonner";
import { ApiError, api, getErrorMessage } from "@/lib/api";

const button =
    "border-2 border-ink px-4 py-2 font-bold uppercase tracking-wide transition-transform " +
    "hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard " +
    "active:translate-x-0 active:translate-y-0 active:shadow-none disabled:opacity-50";

export function SetupCheckPage() {
    const [loading, setLoading] = useState(false);

    async function checkApi() {
        setLoading(true);
        try {
            await api.get("/auth/me/");
            toast.success("API joignable", { description: "Vous êtes déjà connecté." });
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
                // Expected: nobody is logged in yet. It proves the proxy and the error format work.
                toast.success("API joignable", {
                    description: `Réponse attendue : ${error.status} « ${error.message} » (code ${error.code}).`,
                });
            } else {
                toast.error("API injoignable", { description: getErrorMessage(error) });
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="mx-auto max-w-3xl space-y-8 p-6 md:p-10">
            <header className="space-y-2">
                <p className="inline-block border-2 border-ink bg-ink px-2 py-1 text-xs font-bold uppercase tracking-widest text-paper">
                    Étape F1
                </p>
                <h1 className="text-5xl md:text-6xl">HR</h1>
                <p className="text-gray-dark">Gestion des ressources humaines : socle du frontend.</p>
            </header>

            <section className="space-y-4 border-2 border-ink bg-paper p-6 shadow-hard">
                <h2 className="text-2xl">Palette et typographie</h2>
                <div className="grid grid-cols-5 gap-2 text-xs font-bold">
                    <div className="border-2 border-ink bg-ink p-3 text-paper">Noir</div>
                    <div className="border-2 border-ink bg-paper p-3">Blanc</div>
                    <div className="border-2 border-ink bg-gray-light p-3">Gris clair</div>
                    <div className="border-2 border-ink bg-gray-mid p-3">Gris moyen</div>
                    <div className="border-2 border-ink bg-gray-dark p-3 text-paper">Gris foncé</div>
                </div>
                <p>
                    Titres en <span className="font-display font-bold">Space Grotesk</span>, texte d'interface en Inter.
                </p>
                <label className="block space-y-1">
                    <span className="text-sm font-bold uppercase tracking-wide">Champ de saisie</span>
                    <input
                        className="w-full border-2 border-ink bg-paper px-3 py-2 focus:shadow-hard-sm"
                        placeholder="Tape ici (Tab pour voir le focus)"
                    />
                </label>
            </section>

            <section className="space-y-4 border-2 border-ink bg-gray-light p-6 shadow-hard">
                <h2 className="text-2xl">Boutons et notifications</h2>
                <div className="flex flex-wrap gap-3">
                    <button className={`${button} bg-ink text-paper hover:bg-paper hover:text-ink`}>Principal</button>
                    <button className={`${button} bg-paper text-ink hover:bg-ink hover:text-paper`}>Secondaire</button>
                    <button
                        className={`${button} bg-paper`}
                        onClick={() => toast.error("Exemple d'erreur", { description: "Couleurs inversées, pas de teinte." })}
                    >
                        Notification d'erreur
                    </button>
                </div>
            </section>

            <section className="space-y-4 border-2 border-ink bg-paper p-6 shadow-hard">
                <h2 className="text-2xl">Connexion à l'API</h2>
                <p className="text-gray-dark">
                    Lance le backend (<code className="font-bold">python manage.py runserver</code>) puis teste.
                </p>
                <button className={`${button} bg-ink text-paper hover:bg-paper hover:text-ink`} onClick={checkApi} disabled={loading}>
                    {loading ? "Test en cours…" : "Tester l'API"}
                </button>
            </section>
        </main>
    );
}