import { Alert, Card, Skeleton } from "@/components/ui";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { getToday } from "../services/attendanceService";
import { ClockPanel } from "./ClockPanel";

/** Loads today's overview, then shows the shared clock panel. */
export function ClockCard({ onChanged }: { onChanged?: () => void }) {
    const query = useApiQuery(["attendance-today"], (signal) => getToday(signal));

    if (query.error?.status === 404) {
        return (
            <Alert tone="warning" title="Pointage indisponible">
                Aucun dossier employé n'est associé à votre compte : contactez les ressources humaines.
            </Alert>
        );
    }
    if (query.error && !query.data) return <Alert tone="error">{query.error.message}</Alert>;
    if (!query.data) {
        return (
            <Card title="Aujourd'hui">
                <Skeleton className="h-24" />
            </Card>
        );
    }
    return (
        <ClockPanel
            today={query.data}
            onChanged={() => {
                query.reload();
                onChanged?.();
            }}
        />
    );
}