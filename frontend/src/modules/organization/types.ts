/** Node of GET /departments/tree/. */
export interface DepartmentNode {
    id: number;
    code: string;
    name: string;
    is_active: boolean;
    children: DepartmentNode[];
}

/** DepartmentSerializer. */
export interface Department {
    id: number;
    code: string;
    name: string;
    description: string;
    parent: number | null;
    parent_name: string | null;
    is_active: boolean;
    children_count: number;
    positions_count: number;
    employees_count: number;
    created_at: string;
    updated_at: string;
}

export interface DepartmentInput {
    code: string;
    name: string;
    description: string;
    parent: number | null;
}

/** PositionSerializer. `level`: 1 = management ... 10 = operational. */
export interface Position {
    id: number;
    code: string;
    title: string;
    description: string;
    level: number;
    department: number | null;
    department_name: string | null;
    employees_count: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface PositionInput {
    code: string;
    title: string;
    description: string;
    level: number;
    department: number | null;
}