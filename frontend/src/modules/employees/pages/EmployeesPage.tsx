import type { ColumnDef } from "@tanstack/react-table";
import { Download, Eye, Pencil, Plus, Upload, Users } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import {
    Alert,
    Button,
    DataTable,
    DateField,
    EmptyState,
    FilterBar,
    PageHeader,
    Pagination,
    RowActions,
    SearchInput,
    Select,
    StatusBadge,
    buttonStyles,
} from "@/components/ui";
import { saveFile } from "@/lib/download";
import { formatDate } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useListParams } from "@/lib/hooks/useListParams";
import { notify } from "@/lib/notify";
import {
    flattenDepartments,
    getAllPositions,
    getDepartmentTree,
} from "@/modules/organization/services/organizationService";
import { ImportModal } from "../components/ImportModal";
import { exportEmployees, listEmployees } from "../services/employeeService";
import type { EmployeeListItem } from "../types";

const FILTERS = ["employment_status", "department", "position", "hire_date_from", "hire_date_to"] as const;

function EmployeeActions({ employee }: { employee: EmployeeListItem }) {
    return (
        <RowActions
            label={`Actions pour ${employee.first_name} ${employee.last_name}`}
            items={[
                { label: "Voir la fiche", icon: Eye, to: `/employees/${employee.id}` },
                { label: "Modifier", icon: Pencil, to: `/employees/${employee.id}/edit` },
            ]}
        />
    );
}

const columns: ColumnDef<EmployeeListItem>[] = [
    { accessorKey: "matricule", header: "Matricule", cell: ({ getValue }) => <strong>{String(getValue())}</strong> },
    {
        accessorKey: "last_name",
        header: "Employé",
        cell: ({ row }) => (
            <Link
                to={`/employees/${row.original.id}`}
                className="font-bold underline underline-offset-4 hover:bg-ink hover:text-paper"
            >
                {row.original.last_name} {row.original.first_name}
            </Link>
        ),
    },
    { id: "department_name", header: "Département", enableSorting: false, cell: ({ row }) => row.original.department_name },
    { id: "position_title", header: "Poste", enableSorting: false, cell: ({ row }) => row.original.position_title },
    { accessorKey: "hire_date", header: "Embauche", cell: ({ row }) => formatDate(row.original.hire_date) },
    {
        id: "employment_status",
        header: "Statut",
        enableSorting: false,
        cell: ({ row }) => <StatusBadge domain="employee" status={row.original.employment_status} />,
    },
    {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => <EmployeeActions employee={row.original} />,
    },
];

export function EmployeesPage() {
    const navigate = useNavigate();
    const list = useListParams(FILTERS);
    const [version, setVersion] = useState(0);
    const [importing, setImporting] = useState(false);
    const [exporting, setExporting] = useState(false);

    // The same filters feed the list and the export (the export ignores the page).
    const filterParams = {
        search: list.search || undefined,
        ordering: list.ordering || undefined,
        employment_status: list.filters.employment_status || undefined,
        department: list.filters.department || undefined,
        position: list.filters.position || undefined,
        hire_date_from: list.filters.hire_date_from || undefined,
        hire_date_to: list.filters.hire_date_to || undefined,
    };
    const params = { ...filterParams, page: list.page };
    const query = useApiQuery(["employees", params, version], (signal) => listEmployees(params, signal));
    const departments = useApiQuery(["departments-tree"], (signal) => getDepartmentTree(signal));
    const positions = useApiQuery(["positions-active"], (signal) => getAllPositions(signal));

    async function handleExport() {
        setExporting(true);
        try {
            saveFile(await exportEmployees(filterParams));
            notify.success("Export téléchargé", "Il respecte les filtres en cours.");
        } catch (error) {
            notify.error(error);
        } finally {
            setExporting(false);
        }
    }

    const firstLoad = query.loading && !query.data;

    return (
        <>
            <PageHeader
                title="Employés"
                description="Dossiers du personnel."
                actions={
                    <>
                        <Button variant="secondary" onClick={() => setImporting(true)} leftIcon={<Upload className="size-4" aria-hidden="true" />}>
                            Importer
                        </Button>
                        <Button variant="secondary" onClick={() => void handleExport()} loading={exporting} leftIcon={<Download className="size-4" aria-hidden="true" />}>
                            Exporter
                        </Button>
                        <Link to="/employees/new" className={buttonStyles()}>
                            <Plus className="size-4" aria-hidden="true" />
                            Nouvel employé
                        </Link>
                    </>
                }
            />

            <FilterBar canReset={list.hasActiveFilters} onReset={list.reset}>
                <SearchInput className="w-full max-w-xs" value={list.searchText} onChange={list.setSearchText} placeholder="Matricule, nom, e-mail…" />
                <Select label="Statut" className="min-w-40" value={list.filters.employment_status} placeholder="Tous" onChange={(e) => list.setFilter("employment_status", e.target.value)}>
                    <option value="ACTIVE">En poste</option>
                    <option value="SUSPENDED">Suspendu</option>
                    <option value="TERMINATED">Sorti</option>
                </Select>
                <Select label="Département" className="min-w-56" value={list.filters.department} placeholder="Tous" onChange={(e) => list.setFilter("department", e.target.value)}>
                    {flattenDepartments(departments.data ?? []).map((option) => (
                        <option key={option.id} value={option.id}>
                            {option.label}
                        </option>
                    ))}
                </Select>
                <Select label="Poste" className="min-w-56" value={list.filters.position} placeholder="Tous" onChange={(e) => list.setFilter("position", e.target.value)}>
                    {(positions.data ?? []).map((position) => (
                        <option key={position.id} value={position.id}>
                            {position.code} · {position.title}
                        </option>
                    ))}
                </Select>
                <DateField label="Embauché du" value={list.filters.hire_date_from} onChange={(e) => list.setFilter("hire_date_from", e.target.value)} />
                <DateField label="Au" value={list.filters.hire_date_to} onChange={(e) => list.setFilter("hire_date_to", e.target.value)} />
            </FilterBar>

            {query.error && (
                <Alert tone="error" title="Impossible de charger les employés" className="mb-4">
                    <p>{query.error.message}</p>
                    <Button size="sm" variant="secondary" className="mt-2" onClick={query.reload}>
                        Réessayer
                    </Button>
                </Alert>
            )}

            <div aria-busy={query.loading || undefined} className={query.loading && query.data ? "opacity-60" : undefined}>
                <DataTable
                    caption="Liste des employés"
                    columns={columns}
                    data={query.data?.results ?? []}
                    loading={firstLoad}
                    getRowId={(row) => String(row.id)}
                    sorting={list.sorting}
                    onSortingChange={list.setSorting}
                    onRowClick={(row) => navigate(`/employees/${row.id}`)}
                    emptyState={
                        list.hasActiveFilters ? (
                            <EmptyState
                                icon={Users}
                                title="Aucun résultat"
                                description="Aucun employé ne correspond à ces critères."
                                action={<Button variant="secondary" onClick={list.reset}>Réinitialiser les filtres</Button>}
                            />
                        ) : (
                            <EmptyState
                                icon={Users}
                                title="Aucun employé"
                                description="Créez le premier dossier, ou importez un fichier CSV."
                                action={
                                    <Link to="/employees/new" className={buttonStyles()}>
                                        Ajouter un employé
                                    </Link>
                                }
                            />
                        )
                    }
                    renderMobileCard={(row) => (
                        <div className="space-y-2">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <Link to={`/employees/${row.id}`} className="font-bold underline underline-offset-4">
                                        {row.last_name} {row.first_name}
                                    </Link>
                                    <p className="text-sm text-gray-dark">{row.matricule} · {row.department_name}</p>
                                    <p className="text-sm text-gray-dark">{row.position_title}</p>
                                </div>
                                <EmployeeActions employee={row} />
                            </div>
                            <StatusBadge domain="employee" status={row.employment_status} />
                        </div>
                    )}
                />
            </div>
            <Pagination page={list.page} count={query.data?.count ?? 0} onPageChange={list.setPage} />

            <ImportModal open={importing} onClose={() => setImporting(false)} onImported={() => setVersion((current) => current + 1)} />
        </>
    );
}