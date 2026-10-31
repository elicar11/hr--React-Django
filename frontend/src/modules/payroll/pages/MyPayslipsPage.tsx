import { Banknote } from "lucide-react";
import { useState } from "react";
import { Alert, Card, EmptyState, PageHeader, Pagination } from "@/components/ui";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { PayslipsTable } from "../components/PayslipsTable";
import { listPayslips } from "../services/payrollService";

/** Employee space: only the user's own validated or paid payslips (the API enforces it). */
export function MyPayslipsPage() {
    const [page, setPage] = useState(1);
    const params = { page, ordering: "-created_at" };
    const query = useApiQuery(["my-payslips", params], (signal) => listPayslips(params, signal));
    const hasDemo = (query.data?.results ?? []).some((payslip) => payslip.is_demo);

    return (
        <>
            <PageHeader title="Mes bulletins" description="Vos bulletins de paie validés ou payés." />
            {hasDemo && (
                <Alert tone="warning" title="DÉMO : bulletins non utilisables pour une paie réelle" className="mb-4">
                    Certains bulletins ont été calculés avec des paramètres fictifs.
                </Alert>
            )}
            {query.error && <Alert tone="error" className="mb-4">{query.error.message}</Alert>}
            <Card title="Bulletins">
                <PayslipsTable
                    caption="Mes bulletins de paie"
                    rows={query.data?.results ?? []}
                    loading={query.loading && !query.data}
                    showEmployee={false}
                    showPeriod
                    detailPath={(payslip) => `/my/payslips/${payslip.id}`}
                    emptyState={<EmptyState icon={Banknote} title="Aucun bulletin" description="Vos bulletins validés apparaîtront ici." />}
                />
                <Pagination page={page} count={query.data?.count ?? 0} onPageChange={setPage} />
            </Card>
        </>
    );
}