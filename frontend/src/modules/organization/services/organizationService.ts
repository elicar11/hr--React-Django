import { api } from "@/lib/api";
import type { DepartmentNode } from "../types";

/** The whole hierarchy (not paginated): handy for select boxes. */
export async function getDepartmentTree(signal?: AbortSignal): Promise<DepartmentNode[]> {
    const { data } = await api.get<DepartmentNode[]>("/departments/tree/", { signal });
    return data;
}

/** Indented options for a <Select>: "— RH · Ressources humaines" for a sub-department. */
export function flattenDepartments(nodes: DepartmentNode[], depth = 0): { id: number; label: string }[] {
    return nodes.flatMap((node) => [
        { id: node.id, label: `${"— ".repeat(depth)}${node.code} · ${node.name}` },
        ...flattenDepartments(node.children, depth + 1),
    ]);
}