import { SearchX } from "lucide-react";
import { Link } from "react-router";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page introuvable" />
      <EmptyState
        icon={SearchX}
        title="Erreur 404"
        description="La page demandée n'existe pas ou a été déplacée."
        action={
          <Link to="/" className={buttonStyles()}>
            Retour à l'accueil
          </Link>
        }
      />
    </>
  );
}