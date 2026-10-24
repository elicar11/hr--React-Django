import { ShieldAlert } from "lucide-react";
import { Link } from "react-router";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export function ForbiddenPage() {
    return (
        <>
            <PageHeader title="Accès refusé" />
            <EmptyState
                icon={ShieldAlert}
                title="Erreur 403"
                description="Vous n'avez pas les droits nécessaires pour consulter cette page."
                action={
                    <Link to="/" className={buttonStyles()}>
                        Retour à l'accueil
                    </Link>
                }
            />
        </>
    );
}