import type { ColumnDef } from "@tanstack/react-table";
import { ScrollText, X } from "lucide-react";
import { Link } from "react-router";
import {
    Alert,
    Badge,
    Button,
    DataTable,
    DateField,
    EmptyState,
    FilterBar,
    PageHeader,
    Pagination,
    SearchInput,
    Select,
} from "@/components/ui";
import { AUDIT_GROUPS, auditActionLabel } from "@/lib/auditLabels";
import { endOfDayISO, formatDateTime, startOfDayISO } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useListParams } from "@/lib/hooks/useListParams";
import { summarizeMetadata, targetLabel, targetLink } from "../auditTargets";
import { listAuditLogs } from "../services/auditService";
import type { AuditEntry } from "../types";

function Target({ entry }: { entry: AuditEntry }) {
    if (!entry.target_type) return <span className="text-gray-dark">—</span>;
    const link = targetLink(entry.target_type, entry.target_id);
    const label = `${targetLabel(entry.target_type)} n° ${entry.target_id}`;
    return link ? (
        <Link to={link} className="underline underline-offset-4 hover:bg-ink hover:text-paper">
            {label}
        </Link>
    ) : (
        <span>{label}</span>
    );
}

function Details({ entry }: { entry: AuditEntry }) {
    const text = summarizeMetadata(entry.metadata);
    return text ? (
        <span className="block max-w-sm break-words text-sm" title={text}>
            {text}
        </span>
    ) : (
        <span className="text-gray-dark">—</span>
    );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
    return (
        <div className="flex items-center gap-2 border-2 border-ink bg-paper px-3 py-1.5 text-sm">
            <span>{label}</span>
            <button type="button" onClick={onClear} aria-label={`Retirer le filtre : ${label}`} className="p-0.5 hover:bg-ink hover:text-paper">
                <X className="size-4" aria-hidden="true" />
            </button>
        </div>
    );
}

const columns: ColumnDef<AuditEntry>[] = [
    {
        accessorKey: "created_at",
        header: "Date et heure",
        cell: ({ row }) => <time dateTime={row.original.created_at}>{formatDateTime(row.original.created_at)}</time>,
    },
    {
        id: "actor_email",
        header: "Acteur",
        enableSorting: false,
        cell: ({ row }) => row.original.actor_email || <Badge tone="muted">Système / anonyme</Badge>,
    },
    {
        accessorKey: "action",
        header: "Action",
        cell: ({ row }) => (
            <span>
                <strong>{auditActionLabel(row.original.action)}</strong>
                <span className="block font-mono text-xs text-gray-dark">{row.original.action}</span>
            </span>
        ),
    },
    { id: "target", header: "Cible", enableSorting: false, cell: ({ row }) => <Target entry={row.original} /> },
    { id: "ip_address", header: "Adresse IP", enableSorting: false, cell: ({ row }) => row.original.ip_address ?? "—" },
    { id: "details", header: "Détails", enableSorting: false, cell: ({ row }) => <Details entry={row.original} /> },
];

export function AuditPage() {
    const list = useListParams(["action", "created_from", "created_to", "target_type", "target_id", "actor"]);
    const { filters } = list;

    const params = {
        page: list.page,
        search: list.search || undefined,
        ordering: list.ordering || undefined,
        action: filters.action || undefined,
        actor: filters.actor || undefined,
        target_type: filters.target_type || undefined,
        target_id: filters.target_id || undefined,
        created_from: filters.created_from ? startOfDayISO(filters.created_from) : undefined,
        created_to: filters.created_to ? endOfDayISO(filters.created_to) : undefined,
    };
    const query = useApiQuery(["audit-logs", params], (signal) => listAuditLogs(params, signal));

    return (
        <>
            <PageHeader
                title="Journal d'audit"
                description="Trace des opérations de sécurité et d'administration. Lecture seule : le journal ne peut être ni modifié ni supprimé."
            />

            <FilterBar canReset={list.hasActiveFilters} onReset={list.reset}>
                <SearchInput className="w-full max-w-xs" value={list.searchText} onChange={list.setSearchText} placeholder="E-mail, action, cible…" />
                <Select label="Domaine" className="min-w-56" value={filters.action} placeholder="Tous" onChange={(e) => list.setFilter("action", e.target.value)}>
                    {AUDIT_GROUPS.map((group) => (
                        <option key={group.prefix} value={group.prefix}>
                            {group.label}
                        </option>
                    ))}
                </Select>
                <DateField label="Du" value={filters.created_from} max={filters.created_to || undefined} onChange={(e) => list.setFilter("created_from", e.target.value)} />
                <DateField label="Au" value={filters.created_to} min={filters.created_from || undefined} onChange={(e) => list.setFilter("created_to", e.target.value)} />
                {filters.target_type && (
                    <Chip
                        label={`Cible : ${targetLabel(filters.target_type)}${filters.target_id ? ` n° ${filters.target_id}` : ""}`}
                        onClear={() => list.setParams({ target_type: undefined, target_id: undefined, page: undefined })}
                    />
                )}
                {filters.actor && <Chip label={`Acteur n° ${filters.actor}`} onClear={() => list.setFilter("actor", "")} />}
            </FilterBar>

            {query.error && (
                <Alert tone="error" title="Impossible de charger le journal" className="mb-4">
                    <p>{query.error.message}</p>
                    <Button size="sm" variant="secondary" className="mt-2" onClick={query.reload}>
                        Réessayer
                    </Button>
                </Alert>
            )}

            <div aria-busy={query.loading || undefined} className={query.loading && query.data ? "opacity-60" : undefined}>
                <DataTable
                    caption="Journal d'audit"
                    columns={columns}
                    data={query.data?.results ?? []}
                    loading={query.loading && !query.data}
                    getRowId={(row) => String(row.id)}
                    sorting={list.sorting}
                    onSortingChange={list.setSorting}
                    emptyState={
                        <EmptyState
                            icon={ScrollText}
                            title="Aucune entrée"
                            description="Aucune opération enregistrée ne correspond à ces critères."
                            action={list.hasActiveFilters ? <Button variant="secondary" onClick={list.reset}>Réinitialiser les filtres</Button> : undefined}
                        />
                    }
                    renderMobileCard={(row) => (
                        <div className="space-y-1">
                            <p className="font-bold">{auditActionLabel(row.action)}</p>
                            <p className="text-sm text-gray-dark">
                                {row.actor_email || "Système / anonyme"} · <time dateTime={row.created_at}>{formatDateTime(row.created_at)}</time>
                            </p>
                            <p className="text-sm">
                                Cible : <Target entry={row} />
                            </p>
                            {row.ip_address && <p className="text-xs text-gray-dark">IP {row.ip_address}</p>}
                            <Details entry={row} />
                        </div>
                    )}
                />
            </div>
            <Pagination page={list.page} count={query.data?.count ?? 0} onPageChange={list.setPage} />
        </>
    );
}