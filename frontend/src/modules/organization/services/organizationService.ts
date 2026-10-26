import { api, fetchAllPages, type Page } from "@/lib/api";
import type {
    Department,
    DepartmentInput,
    DepartmentNode,
    Position,
    PositionInput,
} from "../types";

export type ListQuery = Record<string, string | number | undefined>;

// --- Departments ---------------------------------------------------------------------------------

export async function listDepartments(params: ListQuery, signal?: AbortSignal): Promise<Page<Department>> {
    const { data } = await api.get<Page<Department>>("/departments/", { params, signal });
    return data;
}

/** Every department (all pages): for counters and select boxes. */
export function getAllDepartments(signal?: AbortSignal): Promise<Department[]> {
    return fetchAllPages<Department>("/departments/", {}, signal);
}

/** The whole hierarchy (not paginated). Active departments only, unless `includeInactive`. */
export async function getDepartmentTree(signal?: AbortSignal, includeInactive = false): Promise<DepartmentNode[]> {
    const { data } = await api.get<DepartmentNode[]>("/departments/tree/", {
        params: includeInactive ? { include_inactive: "true" } : undefined,
        signal,
    });
    return data;
}

export async function createDepartment(input: DepartmentInput): Promise<Department> {
    const { data } = await api.post<Department>("/departments/", input);
    return data;
}

export async function updateDepartment(id: number, input: Partial<DepartmentInput>): Promise<Department> {
    const { data } = await api.patch<Department>(`/departments/${id}/`, input);
    return data;
}

export async function deleteDepartment(id: number): Promise<void> {
    await api.delete(`/departments/${id}/`);
}

export async function setDepartmentActive(id: number, active: boolean): Promise<Department> {
    const { data } = await api.post<Department>(`/departments/${id}/${active ? "activate" : "deactivate"}/`);
    return data;
}

/** Indented options for a <Select>. Excluded ids are removed together with their whole subtree. */
export function flattenDepartments(
    nodes: DepartmentNode[],
    exclude: ReadonlySet<number> = new Set(),
    depth = 0,
): { id: number; label: string }[] {
    return nodes
        .filter((node) => !exclude.has(node.id))
        .flatMap((node) => [
            { id: node.id, label: `${"— ".repeat(depth)}${node.code} · ${node.name}` },
            ...flattenDepartments(node.children, exclude, depth + 1),
        ]);
}

// --- Positions -----------------------------------------------------------------------------------

export async function listPositions(params: ListQuery, signal?: AbortSignal): Promise<Page<Position>> {
    const { data } = await api.get<Page<Position>>("/positions/", { params, signal });
    return data;
}

export async function createPosition(input: PositionInput): Promise<Position> {
    const { data } = await api.post<Position>("/positions/", input);
    return data;
}

export async function updatePosition(id: number, input: Partial<PositionInput>): Promise<Position> {
    const { data } = await api.patch<Position>(`/positions/${id}/`, input);
    return data;
}

export async function deletePosition(id: number): Promise<void> {
    await api.delete(`/positions/${id}/`);
}

export async function setPositionActive(id: number, active: boolean): Promise<Position> {
    const { data } = await api.post<Position>(`/positions/${id}/${active ? "activate" : "deactivate"}/`);
    return data;
}

/** Every active position (all pages): for select boxes. */
export function getAllPositions(signal?: AbortSignal): Promise<Position[]> {
    return fetchAllPages<Position>("/positions/", { is_active: "true" }, signal);
}