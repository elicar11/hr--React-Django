import {
    Banknote,
    Briefcase,
    Building2,
    CalendarDays,
    Flag,
    Layers,
    ListChecks,
    ListPlus,
    Scale,
    ScrollText,
    SlidersHorizontal,
    Tags,
    Timer,
    UserCircle,
    UsersRound,
    type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Badge, PageHeader } from "@/components/ui";
import { useSession } from "@/modules/auth/sessionContext";
import { usePayrollSettings } from "@/modules/payroll/hooks";

function Tile({
    to,
    icon: Icon,
    title,
    description,
    badge,
}: {
    to: string;
    icon: LucideIcon;
    title: string;
    description: string;
    badge?: ReactNode;
}) {
    return (
        <Link
            to={to}
            className="block space-y-2 border-2 border-ink bg-paper p-5 shadow-hard transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg"
        >
            <div className="flex items-start justify-between gap-3">
                <Icon className="size-7 shrink-0" aria-hidden="true" />
                {badge}
            </div>
            <h3 className="text-xl">{title}</h3>
            <p className="text-sm text-gray-dark">{description}</p>
        </Link>
    );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section aria-label={title} className="space-y-3">
            <h2 className="text-2xl">{title}</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
        </section>
    );
}

/**
 * Entry point of the configuration screens. The backend has no general settings:
 * only the payroll has its own, shown here with its current state.
 */
export function SettingsPage() {
    const { user } = useSession();
    const payroll = usePayrollSettings();
    const payrollBadge = payroll.data ? (
        !payroll.data.currency ? (
            <Badge tone="alert">Non configurée</Badge>
        ) : payroll.data.is_demo ? (
            <Badge tone="alert">Démo</Badge>
        ) : (
            <Badge tone="solid">Réelle</Badge>
        )
    ) : undefined;

    return (
        <>
            <PageHeader title="Paramètres" description="Configuration de l'application : organisation, contrats, temps de travail, paie et administration." />
            <div className="space-y-10">
                <Group title="Organisation">
                    <Tile to="/departments" icon={Building2} title="Départements" description="Structure de l'entreprise et organigramme." />
                    <Tile to="/positions" icon={Briefcase} title="Postes" description="Postes et niveaux hiérarchiques." />
                </Group>

                <Group title="Contrats">
                    <Tile to="/contract-types" icon={Tags} title="Types de contrat" description="CDI, CDD… et règle de la date de fin." />
                </Group>

                <Group title="Temps de travail">
                    <Tile to="/work-schedules" icon={Timer} title="Horaires de travail" description="Horaires, tolérances de retard, heures supplémentaires et affectations." />
                    <Tile to="/holidays" icon={Flag} title="Jours fériés" description="Jours non travaillés, exclus des calculs de présences et de congés." />
                    <Tile to="/leave-types" icon={ListChecks} title="Types de congé" description="Mode de décompte, soldes, justificatifs." />
                    <Tile to="/leave-balances" icon={Scale} title="Soldes de congé" description="Allocations par employé et par année." />
                </Group>

                <Group title="Paie">
                    <Tile
                        to="/payroll/settings"
                        icon={SlidersHorizontal}
                        title="Paramètres de paie"
                        description="Devise, heures de référence, majoration des heures supplémentaires, mode démonstration."
                        badge={payrollBadge}
                    />
                    <Tile to="/payroll/item-types" icon={Layers} title="Types d'éléments de paie" description="Primes, indemnités, cotisations, impôts et retenues." />
                    <Tile to="/payroll/elements" icon={ListPlus} title="Éléments par employé" description="Éléments de rémunération récurrents et leur historique." />
                    <Tile to="/payroll" icon={Banknote} title="Périodes et bulletins" description="Génération, calcul, validation et paiement." />
                </Group>

                {user.role === "ADMIN" && (
                    <Group title="Administration">
                        <Tile to="/users" icon={UsersRound} title="Utilisateurs et rôles" description="Comptes de connexion, rôles, activation et liaison avec les employés." />
                        <Tile to="/audit" icon={ScrollText} title="Journal d'audit" description="Trace inaltérable des opérations de sécurité et d'administration." />
                    </Group>
                )}

                <Group title="Mon compte">
                    <Tile to="/profile" icon={UserCircle} title="Mon profil" description="Mes informations et mon mot de passe." />
                    <Tile to="/calendar" icon={CalendarDays} title="Calendrier RH" description="Congés approuvés, demandes en attente et jours fériés." />
                </Group>
            </div>
        </>
    );
}