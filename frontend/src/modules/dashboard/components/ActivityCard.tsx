import { Activity } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";
import { auditActionLabel } from "@/lib/auditLabels";
import { formatDateTime } from "@/lib/format";
import type { ActivityEntry } from "../types";

export function ActivityCard({ entries }: { entries: ActivityEntry[] }) {
    return (
        <Card title="Activité récente" description="Les dernières opérations que vous êtes autorisé à voir">
            {entries.length === 0 ? (
                <EmptyState icon={Activity} title="Aucune activité" />
            ) : (
                <ul className="divide-y-2 divide-ink border-2 border-ink">
                    {entries.map((entry) => (
                        <li key={entry.id} className="p-3">
                            <p className="font-bold">{auditActionLabel(entry.action)}</p>
                            <p className="text-sm text-gray-dark">
                                {entry.actor_email || "Système"} · <time dateTime={entry.created_at}>{formatDateTime(entry.created_at)}</time>
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}