import type { ReactNode } from "react";
import { Link } from "react-router";
import { Alert, Badge, Skeleton, StatusBadge, buttonStyles } from "@/components/ui";
import { fetchPage, type Page } from "@/lib/api";
import { formatDate, formatDecimal, formatMinutes, formatMoney, formatTime } from "@/lib/format";
import { useApiQuery, type ApiQuery } from "@/lib/hooks/useApiQuery";
import type { AttendanceRecord } from "@/modules/attendance/types";
import type { ContractListItem } from "@/modules/contracts/types";
import type { LeaveBalance, LeaveRequest } from "@/modules/leaves/types";
import type { PayElement, PayslipListItem } from "@/modules/payroll/types";

function RelatedSection<T>({
    title,
    query,
    empty,
    viewAllTo,
    getKey,
    render,
}: {
    title: string;
    query: ApiQuery<Page<T>>;
    empty: string;
    viewAllTo?: string;
    getKey: (item: T) => string | number;
    render: (item: T) => ReactNode;
}) {
    const items = query.data?.results ?? [];
    return (
        <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xl">
                    {title}
                    {query.data ? ` (${query.data.count})` : ""}
                </h3>
                {viewAllTo && (
                    <Link to={viewAllTo} className={buttonStyles({ variant: "secondary", size: "sm" })}>
                        Voir tout
                    </Link>
                )}
            </div>
            {query.error && <Alert tone="error">{query.error.message}</Alert>}
            {!query.data && query.loading && <Skeleton className="h-24" />}
            {query.data && items.length === 0 && (
                <p className="border-2 border-dashed border-ink p-4 text-sm text-gray-dark">{empty}</p>
            )}
            {items.length > 0 && (
                <ul className="divide-y-2 divide-ink border-2 border-ink bg-paper">
                    {items.map((item) => (
                        <li key={getKey(item)} className="p-3">
                            {render(item)}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

const row = "flex flex-wrap items-center justify-between gap-2";

export function EmployeeContractsTab({ employeeId }: { employeeId: number }) {
    const query = useApiQuery(["employee-contracts", employeeId], (signal) =>
        fetchPage<ContractListItem>("/contracts/", { employee: employeeId, ordering: "-start_date" }, signal),
    );
    return (
        <RelatedSection
            title="Contrats"
            query={query}
            empty="Aucun contrat enregistré pour cet employé."
            viewAllTo={`/contracts?employee=${employeeId}`}
            getKey={(contract) => contract.id}
            render={(contract) => (
                <div className={row}>
                    <div>
                        <p className="font-bold">
                            {contract.reference} · {contract.contract_type_name}
                        </p>
                        <p className="text-sm text-gray-dark">
                            {formatDate(contract.start_date)} → {contract.end_date ? formatDate(contract.end_date) : "durée indéterminée"} · {contract.position_title}
                        </p>
                    </div>
                    <StatusBadge domain="contract" status={contract.status} />
                </div>
            )}
        />
    );
}

export function EmployeeAttendanceTab({ employeeId }: { employeeId: number }) {
    const query = useApiQuery(["employee-attendance", employeeId], (signal) =>
        fetchPage<AttendanceRecord>("/attendance/", { employee: employeeId, ordering: "-date" }, signal),
    );
    return (
        <RelatedSection
            title="Présences et absences"
            query={query}
            empty="Aucun enregistrement de présence."
            viewAllTo={`/attendance?employee=${employeeId}`}
            getKey={(record) => record.id}
            render={(record) => (
                <div className={row}>
                    <div>
                        <p className="font-bold">{formatDate(record.date)}</p>
                        <p className="text-sm text-gray-dark">
                            {record.status === "PRESENT"
                                ? `${formatTime(record.check_in)} → ${record.check_out ? formatTime(record.check_out) : "en cours"}`
                                : record.absence_reason || "—"}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {record.late_minutes > 0 && <Badge tone="alert">Retard {formatMinutes(record.late_minutes)}</Badge>}
                        <StatusBadge domain="attendance" status={record.status} />
                    </div>
                </div>
            )}
        />
    );
}

export function EmployeeLeavesTab({ employeeId }: { employeeId: number }) {
    const year = new Date().getFullYear();
    const balances = useApiQuery(["employee-balances", employeeId, year], (signal) =>
        fetchPage<LeaveBalance>("/leave-balances/", { employee: employeeId, year }, signal),
    );
    const requests = useApiQuery(["employee-leaves", employeeId], (signal) =>
        fetchPage<LeaveRequest>("/leave-requests/", { employee: employeeId, ordering: "-start_date" }, signal),
    );
    return (
        <div className="space-y-8">
            <RelatedSection
                title={`Soldes ${year}`}
                query={balances}
                empty="Aucun solde défini pour cette année."
                getKey={(balance) => balance.id}
                render={(balance) => (
                    <div className={row}>
                        <p className="font-bold">{balance.leave_type_name}</p>
                        <p className="text-sm">
                            <strong className="font-display text-xl">{formatDecimal(balance.remaining)}</strong> j restants sur {formatDecimal(balance.allocated)} ({formatDecimal(balance.used)} utilisés)
                        </p>
                    </div>
                )}
            />
            <RelatedSection
                title="Demandes de congé"
                query={requests}
                empty="Aucune demande de congé."
                viewAllTo={`/leaves?employee=${employeeId}`}
                getKey={(leave) => leave.id}
                render={(leave) => (
                    <div className={row}>
                        <div>
                            <p className="font-bold">{leave.leave_type_name}</p>
                            <p className="text-sm text-gray-dark">
                                {formatDate(leave.start_date)} → {formatDate(leave.end_date)} · {formatDecimal(leave.days)} j
                            </p>
                        </div>
                        <StatusBadge domain="leave" status={leave.status} />
                    </div>
                )}
            />
        </div>
    );
}

export function EmployeePayTab({ employeeId }: { employeeId: number }) {
    const elements = useApiQuery(["employee-pay-elements", employeeId], (signal) =>
        fetchPage<PayElement>("/pay-elements/", { employee: employeeId }, signal),
    );
    const payslips = useApiQuery(["employee-payslips", employeeId], (signal) =>
        fetchPage<PayslipListItem>("/payslips/", { employee: employeeId }, signal),
    );
    return (
        <div className="space-y-8">
            <RelatedSection
                title="Éléments de rémunération"
                query={elements}
                empty="Aucun élément de rémunération."
                getKey={(element) => element.id}
                render={(element) => (
                    <div className={row}>
                        <div>
                            <p className="font-bold">{element.item_type_name}</p>
                            <p className="text-sm text-gray-dark">
                                Depuis le {formatDate(element.start_date)}
                                {element.end_date ? ` jusqu'au ${formatDate(element.end_date)}` : ""}
                            </p>
                        </div>
                        <Badge tone="outline">
                            {element.amount !== null ? formatDecimal(element.amount) : `${formatDecimal(element.rate ?? "0", 4)} %`}
                        </Badge>
                    </div>
                )}
            />
            <RelatedSection
                title="Bulletins de paie"
                query={payslips}
                empty="Aucun bulletin."
                viewAllTo={`/payroll?employee=${employeeId}`}
                getKey={(payslip) => payslip.id}
                render={(payslip) => (
                    <div className={row}>
                        <div>
                            <p className="font-bold">
                                {payslip.reference} {payslip.is_demo && <Badge tone="alert">Démo</Badge>}
                            </p>
                            <p className="text-sm text-gray-dark">Net : {formatMoney(payslip.net_pay, payslip.currency)}</p>
                        </div>
                        <StatusBadge domain="payslip" status={payslip.status} />
                    </div>
                )}
            />
        </div>
    );
}