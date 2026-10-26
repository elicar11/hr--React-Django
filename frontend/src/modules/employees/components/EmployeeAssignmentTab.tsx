import type { ColumnDef } from "@tanstack/react-table";
import { Repeat } from "lucide-react";
import { useState } from "react";
import { Alert, Badge, Button, Card, DataTable } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { getAssignments } from "../services/employeeService";
import type { Assignment, Employee } from "../types";
import { AssignModal } from "./AssignModal";

const columns: ColumnDef<Assignment>[] = [
    { accessorKey: "start_date", header: "Début", cell: ({ row }) => formatDate(row.original.start_date) },
    { accessorKey: "end_date", header: "Fin", cell: ({ row }) => formatDate(row.original.end_date) || "—" },
    { accessorKey: "department_name", header: "Département" },
    { accessorKey: "position_title", header: "Poste" },
    {
        id: "current",
        header: "Situation",
        enableSorting: false,
        cell: ({ row }) => (row.original.end_date ? <Badge tone="muted">Terminée</Badge> : <Badge tone="solid">Actuelle</Badge>),
    },
];

export function EmployeeAssignmentTab({ employee, onChanged }: { employee: Employee; onChanged: () => void }) {
    const [version, setVersion] = useState(0);
    const [assigning, setAssigning] = useState(false);
    const query = useApiQuery(["assignments", employee.id, version], (signal) => getAssignments(employee.id, signal));
    const terminated = employee.employment_status === "TERMINATED";

    return (
        <div className="space-y-6">
            <Card
                title="Affectation actuelle"
                actions={
                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={terminated}
                        onClick={() => setAssigning(true)}
                        leftIcon={<Repeat className="size-4" aria-hidden="true" />}
                    >
                        Changer d'affectation
                    </Button>
                }
            >
                <p>
                    <strong>{employee.department_name}</strong> · {employee.position_title}
                </p>
                {terminated && <p className="mt-2 text-sm text-gray-dark">Un employé sorti ne peut plus être réaffecté.</p>}
            </Card>

            <section className="space-y-3">
                <h3 className="text-xl">Historique des affectations</h3>
                {query.error && <Alert tone="error">{query.error.message}</Alert>}
                <DataTable
                    caption="Historique des affectations"
                    columns={columns}
                    data={query.data ?? []}
                    loading={query.loading && !query.data}
                    getRowId={(row) => String(row.id)}
                />
            </section>

            <AssignModal
                open={assigning}
                employee={employee}
                onClose={() => setAssigning(false)}
                onSaved={() => {
                    setVersion((current) => current + 1);
                    onChanged();
                }}
            />
        </div>
    );
}