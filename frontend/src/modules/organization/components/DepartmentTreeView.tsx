import { Network } from "lucide-react";
import { useState } from "react";
import { Alert, Button, Checkbox, EmptyState, Skeleton } from "@/components/ui";
import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { getAllDepartments, getDepartmentTree } from "../services/organizationService";
import type { Department } from "../types";
import { DepartmentTree } from "./DepartmentTree";

export function DepartmentTreeView({ version, onEdit }: { version: number; onEdit: (department: Department) => void }) {
    const [includeInactive, setIncludeInactive] = useState(false);
    const tree = useApiQuery(["departments-chart", includeInactive, version], (signal) =>
        getDepartmentTree(signal, includeInactive),
    );
    const all = useApiQuery(["departments-all", version], (signal) => getAllDepartments(signal));

    const stats = new Map((all.data ?? []).map((department) => [department.id, department]));
    const error = tree.error ?? all.error;

    return (
        <div className="space-y-4">
            <Checkbox
                label="Afficher les départements inactifs"
                checked={includeInactive}
                onChange={(event) => setIncludeInactive(event.target.checked)}
            />
            {error && (
                <Alert tone="error" title="Impossible de charger l'organigramme">
                    <p>{error.message}</p>
                    <Button
                        size="sm"
                        variant="secondary"
                        className="mt-2"
                        onClick={() => {
                            tree.reload();
                            all.reload();
                        }}
                    >
                        Réessayer
                    </Button>
                </Alert>
            )}
            {!tree.data && tree.loading && <Skeleton className="h-40" />}
            {tree.data && tree.data.length === 0 && (
                <EmptyState icon={Network} title="Aucun département" description="Créez un premier département pour construire l'organigramme." />
            )}
            {tree.data && tree.data.length > 0 && <DepartmentTree nodes={tree.data} stats={stats} onEdit={onEdit} />}
        </div>
    );
}