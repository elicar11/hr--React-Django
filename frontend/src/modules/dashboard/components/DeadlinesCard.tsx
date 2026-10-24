import { CalendarClock, Hourglass } from "lucide-react";
import { Link } from "react-router";
import { Badge, Card, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { Deadline } from "../types";

export function DeadlinesCard({ deadlines, days }: { deadlines: Deadline[]; days: number }) {
    return (
        <Card title="Échéances RH" description={`Dans les ${days} prochains jours`}>
            {deadlines.length === 0 ? (
                <EmptyState icon={CalendarClock} title="Aucune échéance" description="Rien à anticiper pour le moment." />
            ) : (
                <ul className="divide-y-2 divide-ink border-2 border-ink">
                    {deadlines.map((deadline) => (
                        <li
                            key={`${deadline.type}-${deadline.reference}`}
                            className="flex flex-wrap items-center justify-between gap-3 p-3"
                        >
                            <div>
                                <Link
                                    to={`/employees/${deadline.employee_id}`}
                                    className="font-bold underline underline-offset-4 hover:bg-ink hover:text-paper"
                                >
                                    {deadline.employee_name}
                                </Link>
                                <p className="text-sm text-gray-dark">
                                    {deadline.matricule} · contrat {deadline.reference}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                {deadline.type === "CONTRACT_END" ? (
                                    <Badge tone="outline" icon={CalendarClock}>
                                        Fin de contrat
                                    </Badge>
                                ) : (
                                    <Badge tone="dashed" icon={Hourglass}>
                                        Fin d'essai
                                    </Badge>
                                )}
                                <time dateTime={deadline.date} className="font-bold">
                                    {formatDate(deadline.date)}
                                </time>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}