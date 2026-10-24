/** Node of GET /departments/tree/. */
export interface DepartmentNode {
    id: number;
    code: string;
    name: string;
    is_active: boolean;
    children: DepartmentNode[];
}