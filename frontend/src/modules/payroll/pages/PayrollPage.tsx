import type { ColumnDef } from "@tanstack/react-table";
import { Banknote, Eye, Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import {
    Alert,
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
    StatusBadge,
    TabPanel,
    Tabs,
    buttonStyles,
} from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useListParams } from "@/lib/hooks/useListParams";
import { notify } from "@/lib/notify";
import { EmployeeFilterChip } from "@/modules/employees/components/EmployeeFilterChip";
import { PayrollBanner } from "../components/PayrollBanner";
import { PayslipsTable } from "../components/PayslipsTable";
import { PeriodFormModal } from "../components/PeriodFormModal";
import { usePayrollSettings } from "../hooks";
import { deletePeriod, getAllPeriods, listPayslips, listPeriods } from "../services/payrollService";
import type { PayrollPeriod } from "../types";

type ListParams = ReturnType<typeof useListParams>;

const VIEWS = [
    { id: "periods", label: "Périodes" },
    { id: "payslips", label: "Bulletins" },
];

function PeriodsView({ list, version, onEdit, onDelete, onCreate }: {
    list: ListParams;
    version: number;
    onEdit: (period: PayrollPeriod) => void;
    onDelete: (period: PayrollPeriod) => void;
    onCreate: () => void;
}) {
    const settings = usePayrollSettings();
    const currency = settings.data?.currency ?? "";
    const params = {
        page: list.page,
        search: list.search || undefined,
        ordering: list.ordering || undefined,
        status: list.filters.period_status || undefined,
    };
    const query = useApiQuery(["payroll-periods", params, version], (signal) => listPeriods(params, signal));

    function Actions({ period }: { period: PayrollPeriod }) {
        const open = period.status === "OPEN";
        return (
            <RowActions
                label={`Actions pour la période ${period.code}`}
                items={[
                    { label: "Ouvrir", icon: Eye, to: `/payroll/periods/${period.id}` },
                    ...(open ? [{ label: "Modifier", icon: Pencil, onSelect: () => onEdit(period) }] : []),
                    ...(open ? [{ label: "Supprimer", icon: Trash2, tone: "danger" as const, separatorBefore: true, onSelect: () => onDelete(period) }] : []),
                ]}
            />
        );
    }

    const columns: ColumnDef<PayrollPeriod>[] = [
        {
            accessorKey: "code",
            header: "Période",
            cell: ({ row }) => (
                <Link to={`/payroll/periods/${row.original.id}`} className="font-bold underline underline-offset-4 hover:bg-ink hover:text-paper">
                    {row.original.code}
                </Link>
            ),
        },
        { id: "name", header: "Nom", enableSorting: false, cell: ({ row }) => row.original.name },
        {
            accessorKey: "start_date",
            header: "Dates",
            cell: ({ row }) => `${formatDate(row.original.start_date)} → ${formatDate(row.original.end_date)}`,
        },
        { id: "status", header: "Statut", enableSorting: false, cell: ({ row }) => <StatusBadge domain="period" status={row.original.status} /> },
        { id: "count", header: "Bulletins", enableSorting: false, cell: ({ row }) => row.original.payslips_count ?? 0 },
        {
            id: "net",
            header: "Net total",
            enableSorting: false,
            cell: ({ row }) => <strong>{formatMoney(row.original.total_net ?? "0", currency)}</strong>,
        },
        { id: "actions", header: () => <span className="sr-only">Actions</span>, enableSorting: false, cell: ({ row }) => <Actions period={row.original} /> },
    ];

    return (
        <>
            <FilterBar canReset={list.search !== "" || list.filters.period_status !== ""} onReset={list.reset}>
                <SearchInput className="w-full max-w-xs" value={list.searchText} onChange={list.setSearchText} placeholder="Code ou nom…" />
                <Select label="Statut" className="min-w-40" value={list.filters.period_status} placeholder="Tous" onChange={(e) => list.setFilter("period_status", e.target.value)}>
                    <option value="OPEN">Ouverte</option>
                    <option value="CLOSED">Clôturée</option>
                </Select>
            </FilterBar>
            {query.error && <Alert tone="error" className="mb-4">{query.error.message}</Alert>}
            <div aria-busy={query.loading || undefined} className={query.loading && query.data ? "opacity-60" : undefined}>
                <DataTable
                    caption="Périodes de paie"
                    columns={columns}
                    data={query.data?.results ?? []}
                    loading={query.loading && !query.data}
                    getRowId={(row) => String(row.id)}
                    sorting={list.sorting}
                    onSortingChange={list.setSorting}
                    emptyState={
                        <EmptyState
                            icon={Banknote}
                            title="Aucune période de paie"
                            description="Créez une période (par exemple un mois), puis générez les bulletins."
                            action={<Button onClick={onCreate}>Créer une période</Button>}
                        />
                    }
                    renderMobileCard={(row) => (
                        <div className="space-y-2">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <Link to={`/payroll/periods/${row.id}`} className="font-bold underline underline-offset-4">{row.code}</Link>
                                    <p className="text-sm text-gray-dark">{formatDate(row.start_date)} → {formatDate(row.end_date)}</p>
                                </div>
                                <Actions period={row} />
                            </div>
                            <StatusBadge domain="period" status={row.status} />
                        </div>
                    )}
                />
            </div>
            <Pagination page={list.page} count={query.data?.count ?? 0} onPageChange={list.setPage} />
        </>
    );
}

function PayslipsView({ list }: { list: ListParams }) {
    const params = {
        page: list.page,
        search: list.search || undefined,
        ordering: list.ordering || undefined,
        period: list.filters.period || undefined,
        status: list.filters.status || undefined,
        employee: list.filters.employee || undefined,
    };
    const query = useApiQuery(["payslips", params], (signal) => listPayslips(params, signal));
    const periods = useApiQuery(["payroll-periods-all"], (signal) => getAllPeriods(signal));
    const employeeId = Number(list.filters.employee) || null;

    return (
        <>
            <FilterBar canReset={list.hasActiveFilters} onReset={list.reset}>
                <SearchInput className="w-full max-w-xs" value={list.searchText} onChange={list.setSearchText} placeholder="Référence, matricule, nom…" />
                <Select label="Période" className="min-w-48" value={list.filters.period} placeholder="Toutes" onChange={(e) => list.setFilter("period", e.target.value)}>
                    {(periods.data ?? []).map((period) => (
                        <option key={period.id} value={period.id}>
                            {period.code}
                        </option>
                    ))}
                </Select>
                <Select label="Statut" className="min-w-44" value={list.filters.status} placeholder="Tous" onChange={(e) => list.setFilter("status", e.target.value)}>
                    <option value="DRAFT">Brouillon</option>
                    <option value="CALCULATED">Calculé</option>
                    <option value="VALIDATED">Validé</option>
                    <option value="PAID">Payé</option>
                    <option value="CANCELLED">Annulé</option>
                </Select>
                {employeeId && <EmployeeFilterChip employeeId={employeeId} onClear={() => list.setFilter("employee", "")} />}
            </FilterBar>
            {query.error && <Alert tone="error" className="mb-4">{query.error.message}</Alert>}
            <div aria-busy={query.loading || undefined} className={query.loading && query.data ? "opacity-60" : undefined}>
                <PayslipsTable
                    caption="Bulletins de paie"
                    rows={query.data?.results ?? []}
                    loading={query.loading && !query.data}
                    showEmployee
                    showPeriod
                    detailPath={(payslip) => `/payroll/payslips/${payslip.id}`}
                    sorting={list.sorting}
                    onSortingChange={list.setSorting}
                    emptyState={
                        <EmptyState icon={Banknote} title="Aucun bulletin" description="Générez les bulletins depuis une période de paie." />
                    }
                />
            </div>
            <Pagination page={list.page} count={query.data?.count ?? 0} onPageChange={list.setPage} />
        </>
    );
}

export function PayrollPage() {
    const navigate = useNavigate();
    const list = useListParams(["period_status", "status", "period", "employee"]);
    // The employee sheet links here with ?employee=ID: that means the payslips view.
    const view = (list.getParam("view") || (list.filters.employee ? "payslips" : "periods")) === "payslips" ? "payslips" : "periods";
    const [version, setVersion] = useState(0);
    const refresh = () => setVersion((current) => current + 1);
    const [editing, setEditing] = useState<PayrollPeriod | "new" | null>(null);
    const [deleting, setDeleting] = useState<PayrollPeriod | null>(null);

    return (
        <>
            <PageHeader
                title="Paie"
                description="Périodes de paie et bulletins."
                actions={
                    <>
                        <Link to="/payroll/item-types" className={buttonStyles({ variant: "secondary" })}>Types d'éléments</Link>
                        <Link to="/payroll/elements" className={buttonStyles({ variant: "secondary" })}>Éléments par employé</Link>
                        <Link to="/payroll/settings" className={buttonStyles({ variant: "secondary" })}>
                            <Settings2 className="size-4" aria-hidden="true" />
                            Paramètres
                        </Link>
                        <Button onClick={() => setEditing("new")} leftIcon={<Plus className="size-4" aria-hidden="true" />}>
                            Nouvelle période
                        </Button>
                    </>
                }
            />
            <PayrollBanner />

            <Tabs
                idPrefix="payroll"
                label="Affichage de la paie"
                items={VIEWS}
                value={view}
                onChange={(id) => list.setParams({ view: id, page: undefined })}
            />
            <TabPanel idPrefix="payroll" id="periods" active={view === "periods"}>
                <PeriodsView list={list} version={version} onEdit={setEditing} onDelete={setDeleting} onCreate={() => setEditing("new")} />
            </TabPanel>
            <TabPanel idPrefix="payroll" id="payslips" active={view === "payslips"}>
                <PayslipsView list={list} />
            </TabPanel>

            <PeriodFormModal
                open={editing !== null}
                period={editing === "new" ? null : editing}
                onClose={() => setEditing(null)}
                onSaved={(period) => (editing === "new" ? navigate(`/payroll/periods/${period.id}`) : refresh())}
            />
            <ConfirmDialog
                open={deleting !== null}
                onClose={() => setDeleting(null)}
                tone="danger"
                title="Supprimer cette période ?"
                message={
                    <>
                        <p>Supprimer la période <strong>{deleting?.code}</strong> est irréversible.</p>
                        <p className="mt-2 text-sm text-gray-dark">Si elle contient des bulletins (même annulés), la suppression sera refusée.</p>
                    </>
                }
                confirmLabel="Supprimer"
                onConfirm={async () => {
                    if (!deleting) return;
                    await deletePeriod(deleting.id);
                    notify.success("Période supprimée");
                    refresh();
                }}
            />
        </>
    );
}