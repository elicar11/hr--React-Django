import { FileText, Plus, Tags } from "lucide-react";
import { Link } from "react-router";
import {
    Alert,
    Button,
    DateField,
    EmptyState,
    FilterBar,
    PageHeader,
    Pagination,
    SearchInput,
    Select,
    TabPanel,
    Tabs,
    buttonStyles,
} from "@/components/ui";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { useListParams } from "@/lib/hooks/useListParams";
import { EmployeeFilterChip } from "@/modules/employees/components/EmployeeFilterChip";
import { ContractsTable } from "../components/ContractsTable";
import { getAllContractTypes, listContracts, listExpiringContracts } from "../services/contractService";

type ListParams = ReturnType<typeof useListParams>;

const VIEWS = [
    { id: "all", label: "Tous les contrats" },
    { id: "expiring", label: "Échéances" },
];

function AllContractsView({ list }: { list: ListParams }) {
    const params = {
        page: list.page,
        search: list.search || undefined,
        ordering: list.ordering || undefined,
        status: list.filters.status || undefined,
        contract_type: list.filters.contract_type || undefined,
        employee: list.filters.employee || undefined,
        end_date_from: list.filters.end_date_from || undefined,
        end_date_to: list.filters.end_date_to || undefined,
    };
    const query = useApiQuery(["contracts", params], (signal) => listContracts(params, signal));
    const types = useApiQuery(["contract-types-all"], (signal) => getAllContractTypes(signal, false));
    const employeeId = Number(list.filters.employee) || null;

    return (
        <>
            <FilterBar canReset={list.hasActiveFilters} onReset={list.reset}>
                <SearchInput className="w-full max-w-xs" value={list.searchText} onChange={list.setSearchText} placeholder="Référence, employé…" />
                <Select label="Statut" className="min-w-40" value={list.filters.status} placeholder="Tous" onChange={(e) => list.setFilter("status", e.target.value)}>
                    <option value="DRAFT">Brouillon</option>
                    <option value="ACTIVE">En cours</option>
                    <option value="ENDED">Terminé</option>
                    <option value="TERMINATED">Rompu</option>
                </Select>
                <Select label="Type" className="min-w-44" value={list.filters.contract_type} placeholder="Tous" onChange={(e) => list.setFilter("contract_type", e.target.value)}>
                    {(types.data ?? []).map((type) => (
                        <option key={type.id} value={type.id}>
                            {type.code} · {type.name}
                        </option>
                    ))}
                </Select>
                <DateField label="Fin du" value={list.filters.end_date_from} onChange={(e) => list.setFilter("end_date_from", e.target.value)} />
                <DateField label="Au" value={list.filters.end_date_to} onChange={(e) => list.setFilter("end_date_to", e.target.value)} />
                {employeeId && <EmployeeFilterChip employeeId={employeeId} onClear={() => list.setFilter("employee", "")} />}
            </FilterBar>

            {query.error && (
                <Alert tone="error" title="Impossible de charger les contrats" className="mb-4">
                    <p>{query.error.message}</p>
                    <Button size="sm" variant="secondary" className="mt-2" onClick={query.reload}>
                        Réessayer
                    </Button>
                </Alert>
            )}

            <div aria-busy={query.loading || undefined} className={query.loading && query.data ? "opacity-60" : undefined}>
                <ContractsTable
                    caption="Liste des contrats"
                    rows={query.data?.results ?? []}
                    loading={query.loading && !query.data}
                    sorting={list.sorting}
                    onSortingChange={list.setSorting}
                    emptyState={
                        list.hasActiveFilters ? (
                            <EmptyState
                                icon={FileText}
                                title="Aucun résultat"
                                description="Aucun contrat ne correspond à ces critères."
                                action={<Button variant="secondary" onClick={list.reset}>Réinitialiser les filtres</Button>}
                            />
                        ) : (
                            <EmptyState
                                icon={FileText}
                                title="Aucun contrat"
                                description="Créez d'abord un type de contrat, puis le premier contrat."
                                action={
                                    <Link to="/contracts/new" className={buttonStyles()}>
                                        Créer un contrat
                                    </Link>
                                }
                            />
                        )
                    }
                />
            </div>
            <Pagination page={list.page} count={query.data?.count ?? 0} onPageChange={list.setPage} />
        </>
    );
}

function ExpiringContractsView({ list }: { list: ListParams }) {
    const days = list.filters.days;
    const params = { page: list.page, days: days || undefined };
    const query = useApiQuery(["contracts-expiring", params], (signal) => listExpiringContracts(params, signal));

    return (
        <>
            <FilterBar>
                <Select label="Échéance dans les" className="min-w-48" value={days} placeholder="30 prochains jours (défaut)" onChange={(e) => list.setFilter("days", e.target.value)}>
                    <option value="60">60 prochains jours</option>
                    <option value="90">90 prochains jours</option>
                    <option value="180">180 prochains jours</option>
                </Select>
                <p className="self-center text-sm text-gray-dark">
                    Contrats en cours dont la fin approche, ou dont la date de fin est dépassée (à clôturer).
                </p>
            </FilterBar>

            {query.error && (
                <Alert tone="error" title="Impossible de charger les échéances" className="mb-4">
                    <p>{query.error.message}</p>
                </Alert>
            )}

            <div aria-busy={query.loading || undefined} className={query.loading && query.data ? "opacity-60" : undefined}>
                <ContractsTable
                    caption="Contrats arrivant à échéance"
                    rows={query.data?.results ?? []}
                    loading={query.loading && !query.data}
                    emptyState={<EmptyState icon={FileText} title="Aucune échéance" description="Aucun contrat n'arrive à échéance sur cette période." />}
                />
            </div>
            <Pagination page={list.page} count={query.data?.count ?? 0} onPageChange={list.setPage} />
        </>
    );
}

export function ContractsPage() {
    const list = useListParams(["status", "contract_type", "employee", "end_date_from", "end_date_to", "days"]);
    const view = list.getParam("view") === "expiring" ? "expiring" : "all";

    return (
        <>
            <PageHeader
                title="Contrats"
                description="Contrats de travail, renouvellements et échéances."
                actions={
                    <>
                        <Link to="/contract-types" className={buttonStyles({ variant: "secondary" })}>
                            <Tags className="size-4" aria-hidden="true" />
                            Types de contrat
                        </Link>
                        <Link to="/contracts/new" className={buttonStyles()}>
                            <Plus className="size-4" aria-hidden="true" />
                            Nouveau contrat
                        </Link>
                    </>
                }
            />
            <Tabs
                idPrefix="contracts"
                label="Affichage des contrats"
                items={VIEWS}
                value={view}
                onChange={(id) => list.setParam("view", id === "expiring" ? "expiring" : "")}
            />
            <TabPanel idPrefix="contracts" id="all" active={view === "all"}>
                <AllContractsView list={list} />
            </TabPanel>
            <TabPanel idPrefix="contracts" id="expiring" active={view === "expiring"}>
                <ExpiringContractsView list={list} />
            </TabPanel>
        </>
    );
}