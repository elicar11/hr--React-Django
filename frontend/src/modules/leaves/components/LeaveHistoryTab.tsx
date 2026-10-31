import { History } from "lucide-react";
import { Alert, EmptyState, Skeleton, StatusBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { getLeaveHistory } from "../services/leaveService";
import type { LeaveHistoryEntry } from "../types";

const ACTIONS: Record<LeaveHistoryEntry["action"], string> = {
    CREATED: "Demande créée",
    UPDATED: "Demande modifiée",
    APPROVED: "Demande approuvée",
    REJECTED: "Demande refusée",
    CANCELLED: "Demande annulée",
};

export function LeaveHistoryTab({ leaveId, version }: { leaveId: number; version: number }) {
    const query = useApiQuery(["leave-history", leaveId, version], (signal) => getLeaveHistory(leaveId, signal));
    return (
        <div className="space-y-4">
            {query.error && <Alert tone="error">{query.error.message}</Alert>}
            {!query.data && query.loading && <Skeleton className="h-32" />}
            {query.data && query.data.length === 0 && <EmptyState icon={History} title="Aucun événement" />}
            {query.data && query.data.length > 0 && (
                <ol className="divide-y-2 divide-ink border-2 border-ink bg-paper">
                    {query.data.map((entry) => (
                        <li key={entry.id} className="space-y-1 p-3">
                            <div className="flex flex-wrap items-center gap-3">
                                <p className="font-bold">{ACTIONS[entry.action] ?? entry.action}</p>
                                {entry.from_status && entry.to_status && entry.from_status !== entry.to_status && (
                                    <span className="flex items-center gap-2 text-sm">
                                        <StatusBadge domain="leave" status={entry.from_status} /> →{" "}
                                        <StatusBadge domain="leave" status={entry.to_status} />
                                    </span>
                                )}
                            </div>
                            {entry.comment && <p className="text-sm">« {entry.comment} »</p>}
                            <p className="text-sm text-gray-dark">
                                {entry.actor_email || "Système"} · <time dateTime={entry.created_at}>{formatDateTime(entry.created_at)}</time>
                            </p>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}