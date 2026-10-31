export interface AuditEntry {
    id: number;
    created_at: string;
    actor: number | null;
    /** Snapshot taken at the time: stays readable even if the account changes later. */
    actor_email: string;
    action: string;
    /** Django model label, e.g. "employees.employee". Empty for events without a target. */
    target_type: string;
    target_id: string;
    /** Field names, codes, identifiers: never passwords, amounts or reasons. */
    metadata: Record<string, unknown>;
    ip_address: string | null;
}