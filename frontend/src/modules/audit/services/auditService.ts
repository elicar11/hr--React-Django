import { fetchPage, type Page } from "@/lib/api";
import type { AuditEntry } from "../types";

export type ListQuery = Record<string, string | number | undefined>;

/** ADMIN only. Read-only: the trail can neither be edited nor deleted. */
export function listAuditLogs(params: ListQuery, signal?: AbortSignal): Promise<Page<AuditEntry>> {
    return fetchPage<AuditEntry>("/audit-logs/", params, signal);
}