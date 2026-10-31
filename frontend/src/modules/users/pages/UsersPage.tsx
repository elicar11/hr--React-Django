import type { ColumnDef } from "@tanstack/react-table";
import { Link2, Pencil, Plus, Power, PowerOff, UsersRound } from "lucide-react";
import { useState } from "react";
import {
    ActiveBadge,
    Alert,
    Badge,
    Button,
    ConfirmDialog,
    DataTable,
    EmptyState,
    FilterBar,
    PageHeader,
    Pagination,
    RowActions,
    SearchInput,
    Select,
    type BadgeTone,
} from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useListParams } from "@/lib/hooks/useListParams";
import { notify } from "@/lib/notify";
import { useSession } from "@/modules/auth/sessionContext";
import { ROLE_LABELS, type Role, type User } from "@/modules/auth/types";
import { LinkEmployeeModal } from "../components/LinkEmployeeModal";
import { UserFormModal } from "../components/UserFormModal";
import { listUsers, setUserActive } from "../services/userService";

const ROLE_TONES: Record<Role, BadgeTone> = { ADMIN: "solid", HR: "outline", EMPLOYEE: "muted" };

export function UsersPage() {
    const { user: currentUser } = useSession();
    const list = useListParams(["role", "is_active"]);
    const [version, setVersion] = useState(0);
    const refresh = () => setVersion((current) => current + 1);
    const [editing, setEditing] = useState<User | "new" | null>(null);
    const [linking, setLinking] = useState<User | null>(null);
    const [deactivating, setDeactivating] = useState<User | null>(null);

    const params = {
        page: list.page,
        search: list.search || undefined,
        ordering: list.ordering || undefined,
        role: list.filters.role || undefined,
        is_active: list.filters.is_active || undefined,
    };
    const query = useApiQuery(["users", params, version], (signal) => listUsers(params, signal));

    async function activate(target: User) {
        try {
            await setUserActive(target.id, true);
            notify.success("Compte activé");
            refresh();
        } catch (error) {
            notify.error(error);
        }
    }

    function UserActions({ target }: { target: User }) {
        const isSelf = target.id === currentUser.id;
        return (
            <RowActions
                label={`Actions pour ${target.email}`}
                items={[
                    { label: "Modifier", icon: Pencil, onSelect: () => setEditing(target) },
                    { label: "Lier à un employé", icon: Link2, onSelect: () => setLinking(target) },
                    target.is_active
                        ? { label: "Désactiver", icon: PowerOff, tone: "danger", disabled: isSelf, separatorBefore: true, onSelect: () => setDeactivating(target) }
                        : { label: "Activer", icon: Power, separatorBefore: true, onSelect: () => void activate(target) },
                ]}
            />
        );
    }

    const columns: ColumnDef<User>[] = [
        {
            accessorKey: "last_name",
            header: "Nom",
            cell: ({ row }) => (
                <span>
                    <strong>
                        {row.original.last_name} {row.original.first_name}
                    </strong>
                    {row.original.id === currentUser.id && <Badge tone="dashed">Vous</Badge>}
                </span>
            ),
        },
        { accessorKey: "email", header: "E-mail" },
        {
            id: "role",
            header: "Rôle",
            enableSorting: false,
            cell: ({ row }) => <Badge tone={ROLE_TONES[row.original.role]}>{ROLE_LABELS[row.original.role]}</Badge>,
        },
        { id: "is_active", header: "Statut", enableSorting: false, cell: ({ row }) => <ActiveBadge active={row.original.is_active} /> },
        {
            id: "last_login",
            header: "Dernière connexion",
            enableSorting: false,
            cell: ({ row }) => formatDateTime(row.original.last_login) || "Jamais",
        },
        { accessorKey: "date_joined", header: "Créé le", cell: ({ row }) => formatDate(row.original.date_joined) },
        {
            id: "actions",
            header: () => <span className="sr-only">Actions</span>,
            enableSorting: false,
            cell: ({ row }) => <UserActions target={row.original} />,
        },
    ];

    return (
        <>
            <PageHeader
                title="Utilisateurs et rôles"
                description="Comptes de connexion et niveaux d'accès. Les droits sont appliqués par le serveur à chaque opération."
                actions={
                    <Button onClick={() => setEditing("new")} leftIcon={<Plus className="size-4" aria-hidden="true" />}>
                        Nouveau compte
                    </Button>
                }
            />

            <FilterBar canReset={list.hasActiveFilters} onReset={list.reset}>
                <SearchInput className="w-full max-w-xs" value={list.searchText} onChange={list.setSearchText} placeholder="Nom, prénom, e-mail…" />
                <Select label="Rôle" className="min-w-48" value={list.filters.role} placeholder="Tous" onChange={(e) => list.setFilter("role", e.target.value)}>
                    {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
                        <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                        </option>
                    ))}
                </Select>
                <Select label="Statut" className="min-w-40" value={list.filters.is_active} placeholder="Tous" onChange={(e) => list.setFilter("is_active", e.target.value)}>
                    <option value="true">Actifs</option>
                    <option value="false">Désactivés</option>
                </Select>
            </FilterBar>

            {query.error && (
                <Alert tone="error" title="Impossible de charger les comptes" className="mb-4">
                    <p>{query.error.message}</p>
                    <Button size="sm" variant="secondary" className="mt-2" onClick={query.reload}>
                        Réessayer
                    </Button>
                </Alert>
            )}

            <div aria-busy={query.loading || undefined} className={query.loading && query.data ? "opacity-60" : undefined}>
                <DataTable
                    caption="Comptes utilisateurs"
                    columns={columns}
                    data={query.data?.results ?? []}
                    loading={query.loading && !query.data}
                    getRowId={(row) => String(row.id)}
                    sorting={list.sorting}
                    onSortingChange={list.setSorting}
                    emptyState={
                        <EmptyState
                            icon={UsersRound}
                            title="Aucun compte"
                            description="Aucun compte ne correspond à ces critères."
                            action={<Button variant="secondary" onClick={list.reset}>Réinitialiser les filtres</Button>}
                        />
                    }
                    renderMobileCard={(row) => (
                        <div className="space-y-2">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="font-bold">
                                        {row.last_name} {row.first_name}
                                    </p>
                                    <p className="text-sm text-gray-dark">{row.email}</p>
                                </div>
                                <UserActions target={row} />
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge tone={ROLE_TONES[row.role]}>{ROLE_LABELS[row.role]}</Badge>
                                <ActiveBadge active={row.is_active} />
                            </div>
                            <p className="text-sm text-gray-dark">Dernière connexion : {formatDateTime(row.last_login) || "jamais"}</p>
                        </div>
                    )}
                />
            </div>
            <Pagination page={list.page} count={query.data?.count ?? 0} onPageChange={list.setPage} />

            <UserFormModal
                open={editing !== null}
                user={editing === "new" ? null : editing}
                currentUserId={currentUser.id}
                onClose={() => setEditing(null)}
                onSaved={refresh}
            />
            {linking && <LinkEmployeeModal open user={linking} onClose={() => setLinking(null)} onSaved={refresh} />}
            <ConfirmDialog
                open={deactivating !== null}
                onClose={() => setDeactivating(null)}
                tone="danger"
                title="Désactiver ce compte ?"
                message={
                    <>
                        <p>
                            <strong>{deactivating?.email}</strong> ne pourra plus se connecter, et toutes ses sessions en cours sont révoquées
                            immédiatement.
                        </p>
                        <p className="mt-2 text-sm text-gray-dark">Le compte n'est pas supprimé : vous pourrez le réactiver.</p>
                    </>
                }
                confirmLabel="Désactiver"
                onConfirm={async () => {
                    if (!deactivating) return;
                    await setUserActive(deactivating.id, false);
                    notify.success("Compte désactivé");
                    refresh();
                }}
            />
        </>
    );
}