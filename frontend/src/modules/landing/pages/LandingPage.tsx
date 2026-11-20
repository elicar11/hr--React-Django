import {
    ArrowRight,
    Banknote,
    Building2,
    CalendarDays,
    Check,
    Clock,
    FileText,
    KeyRound,
    LayoutDashboard,
    ShieldCheck,
    Users,
    type LucideIcon,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { cx } from "@/lib/cx";
import { HeroPreview } from "../components/HeroPreview";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";

interface Feature {
    icon: LucideIcon;
    title: string;
    description: string;
}

const FEATURES: Feature[] = [
    { icon: LayoutDashboard, title: "Tableau de bord", description: "Indicateurs clés, échéances, activité récente et alertes, sur une seule page." },
    { icon: Users, title: "Employés", description: "Dossiers complets, photo, historique des affectations, import et export CSV." },
    { icon: Building2, title: "Organisation", description: "Départements en arborescence, organigramme et postes par niveau." },
    { icon: FileText, title: "Contrats", description: "Types de contrat, renouvellements, échéances à venir et documents PDF." },
    { icon: Clock, title: "Présences", description: "Pointage horodaté par le serveur, retards, corrections validées, horaires et jours fériés." },
    { icon: CalendarDays, title: "Congés", description: "Demandes, soldes, justificatifs, validation et calendrier des absences." },
    {
        icon: Banknote,
        title: "Paie",
        description: "Périodes, bulletins calculés puis validés, paiement. Mode démonstration tant que les paramètres légaux ne sont pas validés.",
    },
    { icon: ShieldCheck, title: "Administration", description: "Comptes, rôles et journal d'audit des opérations sensibles." },
];

const STEPS = [
    { title: "Configurer", description: "L'administrateur crée les comptes, les départements, les postes et les types de contrat." },
    { title: "Renseigner", description: "Les ressources humaines saisissent les employés, leurs contrats, leurs horaires et leurs soldes de congé." },
    { title: "Utiliser au quotidien", description: "Les employés pointent, demandent leurs congés et consultent leurs bulletins." },
];

const ROLES = [
    {
        name: "Administrateur",
        points: [
            "Crée les comptes et attribue les rôles",
            "Consulte le journal d'audit",
            "Règle les paramètres de l'application",
            "Gère les cas sensibles : annulation d'un bulletin validé, réouverture d'une période de paie",
        ],
    },
    {
        name: "Ressources humaines",
        points: [
            "Gère les dossiers employés et les contrats",
            "Suit les présences et valide les corrections",
            "Traite les demandes de congé et les soldes",
            "Calcule, valide et règle la paie (jamais la sienne)",
        ],
    },
    {
        name: "Employé",
        points: [
            "Consulte son dossier et ses contrats",
            "Pointe son entrée et sa sortie",
            "Demande ses congés et suit ses soldes",
            "Retrouve ses bulletins validés",
        ],
    },
];

const SECURITY = [
    { icon: ShieldCheck, text: "Les droits sont appliqués par le serveur à chaque opération, pas seulement masqués à l'écran." },
    { icon: KeyRound, text: "Session courte : accès de 15 minutes, renouvelé par un cookie protégé (HttpOnly). Tentatives de connexion limitées." },
    { icon: FileText, text: "Journal d'audit des opérations sensibles, sans mot de passe, montant ni motif enregistrés." },
    { icon: Users, text: "Chaque employé ne voit que ses propres données : celles des autres répondent « introuvable »." },
];

const INVERTED_BUTTON =
    "inline-flex items-center justify-center gap-2 border-2 border-paper bg-paper px-5 py-3 font-bold uppercase tracking-wide text-ink shadow-[4px_4px_0_#fff] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 focus-visible:outline-paper";

function Section({
    id,
    title,
    intro,
    shaded = false,
    children,
}: {
    id: string;
    title: string;
    intro?: string;
    shaded?: boolean;
    children: ReactNode;
}) {
    const { t } = useTranslation();
    return (
        <section id={id} aria-labelledby={`${id}-titre`} className={cx("scroll-mt-20 border-b-2 border-ink", shaded && "bg-gray-light")}>
            <div className="mx-auto max-w-6xl space-y-10 px-4 py-14 md:px-8 lg:py-20">
                <div className="max-w-2xl space-y-3">
                    <h2 id={`${id}-titre`} className="text-4xl md:text-5xl">
                        {t(title)}
                    </h2>
                {intro && <p className="text-lg text-gray-dark">{t(intro)}</p>}
                </div>
                {children}
            </div>
        </section>
    );
}

/** Public home page, shown to visitors who are not signed in. */
export function LandingPage() {
    const { t } = useTranslation();
    useEffect(() => {
        document.title = `HR · ${t("Gestion des ressources humaines")}`;
    }, [t]);

    return (
        <div className="min-h-dvh overflow-x-clip bg-paper text-ink">
            <a
                href="#contenu"
                className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:border-2 focus:border-ink focus:bg-paper focus:px-4 focus:py-2 focus:font-bold"
            >
                {t("Aller au contenu")}
            </a>

            <header className="sticky top-0 z-30 border-b-2 border-ink bg-paper">
                <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-8">
                    <Link to="/" aria-label={t("HR, ressources humaines")} className="flex items-center gap-3">
                        <span className="flex size-10 items-center justify-center border-2 border-ink bg-ink font-display text-xl font-bold text-paper">
                            HR
                        </span>
                        <span className="hidden font-display text-lg font-bold sm:block">{t("Ressources humaines")}</span>
                    </Link>
                    <nav aria-label={t("Sections de la page")} className="hidden items-center gap-6 font-bold md:flex">
                        <a href="#fonctionnalites" className="underline-offset-4 hover:underline">{t("Fonctionnalités")}</a>
                        <a href="#roles" className="underline-offset-4 hover:underline">{t("Rôles")}</a>
                        <a href="#securite" className="underline-offset-4 hover:underline">{t("Sécurité")}</a>
                    </nav>
                    <div className="flex items-center gap-3"><LanguageSwitcher /><Link to="/login" className={buttonStyles()}>{t("Se connecter")}</Link></div>
                </div>
            </header>

            <main id="contenu">
                <section aria-labelledby="titre-accueil" className="border-b-2 border-ink">
                    <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 md:px-8 lg:grid-cols-2 lg:py-24">
                        <div className="min-w-0 space-y-6">
                            <p className="inline-block border-2 border-ink px-3 py-1 text-xs font-bold uppercase tracking-widest">
                                {t("Gestion des ressources humaines")}
                            </p>
                            <h1 id="titre-accueil" className="break-words text-5xl sm:text-6xl lg:text-7xl">
                                {t("La gestion RH, claire et sous contrôle.")}
                            </h1>
                            <p className="max-w-xl text-lg text-gray-dark">
                                {t("Employés, contrats, présences, congés et paie réunis dans une seule application, avec des accès adaptés à chaque rôle.")}
                            </p>
                            <div className="flex flex-wrap gap-3">
                                <Link to="/login" className={buttonStyles()}>
                                    {t("Se connecter")}
                                    <ArrowRight className="size-4" aria-hidden="true" />
                                </Link>
                                <a href="#fonctionnalites" className={buttonStyles({ variant: "secondary" })}>
                                    {t("Découvrir les fonctionnalités")}
                                </a>
                            </div>
                        </div>
                        <div className="min-w-0">
                            <HeroPreview />
                        </div>
                    </div>
                </section>

                <Section
                    id="fonctionnalites"
                    title="Tout ce qu'il faut, au même endroit"
                    intro="Chaque module couvre un volet de la gestion du personnel, du recrutement à la fiche de paie."
                    shaded
                >
                    <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        {FEATURES.map(({ icon: Icon, title, description }) => (
                            <li key={title} className="min-w-0 space-y-3 border-2 border-ink bg-paper p-5 shadow-hard">
                                <Icon className="size-8" aria-hidden="true" />
                                <h3 className="text-xl">{t(title)}</h3>
                                <p className="text-sm text-gray-dark">{t(description)}</p>
                            </li>
                        ))}
                    </ul>
                </Section>

                <Section id="demarrage" title="Comment ça marche" intro="Trois étapes, de la mise en place à l'usage quotidien.">
                    <ol className="grid grid-cols-1 gap-5 md:grid-cols-3">
                        {STEPS.map((step, index) => (
                            <li key={step.title} className="min-w-0 space-y-3 border-2 border-ink p-5">
                                <span aria-hidden="true" className="font-display text-6xl font-bold">
                                    {index + 1}
                                </span>
                                <h3 className="text-2xl">{t(step.title)}</h3>
                                <p className="text-gray-dark">{t(step.description)}</p>
                            </li>
                        ))}
                    </ol>
                </Section>

                <Section id="roles" title="Un accès adapté à chaque rôle" intro="Trois profils, avec des droits distincts appliqués par le serveur." shaded>
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                        {ROLES.map((role) => (
                            <article key={role.name} className="min-w-0 space-y-4 border-2 border-ink bg-paper p-5 shadow-hard">
                                <h3 className="border-b-2 border-ink pb-3 text-2xl">{t(role.name)}</h3>
                                <ul className="space-y-3">
                                    {role.points.map((point) => (
                                        <li key={point} className="flex gap-3">
                                            <Check className="mt-1 size-4 shrink-0" aria-hidden="true" />
                                            <span>{t(point)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </article>
                        ))}
                    </div>
                </Section>

                <Section id="securite" title="Sécurité et confidentialité" intro="Les données du personnel sont sensibles : les accès sont limités et les opérations tracées.">
                    <ul className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        {SECURITY.map(({ icon: Icon, text }) => (
                            <li key={text} className="flex min-w-0 gap-4 border-2 border-ink p-5">
                                <Icon className="size-7 shrink-0" aria-hidden="true" />
                            <p>{t(text)}</p>
                            </li>
                        ))}
                    </ul>
                </Section>

                <section aria-labelledby="titre-connexion" className="bg-ink text-paper">
                    <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 md:px-8 lg:flex-row lg:items-center lg:justify-between lg:py-20">
                        <div className="max-w-2xl space-y-3">
                            <h2 id="titre-connexion" className="text-4xl md:text-5xl">
                                {t("Prêt à vous connecter ?")}
                            </h2>
                            <p className="text-lg">{t("Utilisez le compte créé par votre administrateur.")}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-6">
                            <Link to="/login" className={INVERTED_BUTTON}>
                                {t("Se connecter")}
                                <ArrowRight className="size-4" aria-hidden="true" />
                            </Link>
                            <Link to="/forgot-password" className="font-bold underline underline-offset-4 focus-visible:outline-paper">
                                {t("Mot de passe oublié ?")}
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="border-t-2 border-ink">
                <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm md:px-8">
                    <p>© {new Date().getFullYear()} HR · {t("Gestion des ressources humaines")}</p>
                    <nav aria-label={t("Liens du pied de page")} className="flex gap-5 font-bold">
                        <Link to="/login" className="underline-offset-4 hover:underline">{t("Connexion")}</Link>
                        <Link to="/forgot-password" className="underline-offset-4 hover:underline">{t("Mot de passe oublié")}</Link>
                    </nav>
                </div>
            </footer>
        </div>
    );
}
