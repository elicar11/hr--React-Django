import { Construction } from "lucide-react";
import { Link } from "react-router";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

/** Explicit state of a section that is not built yet (never a blank page). */
export function ComingSoonPage({ title, step }: { title: string; step: string }) {
    return (
        <>
            <PageHeader title={title} />
            <EmptyState
                icon={Construction}
                title="Section en cours de développement"
                description={`Cette page sera disponible à l'étape ${step} du frontend. Les données correspondantes existent déjà côté API.`}
                action={
                    <Link to="/" className={buttonStyles({ variant: "secondary" })}>
                        Retour au tableau de bord
                    </Link>
                }
            />
        </>
    );
}