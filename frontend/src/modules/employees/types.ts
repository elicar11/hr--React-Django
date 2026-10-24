export type EmploymentStatus = "ACTIVE" | "SUSPENDED" | "TERMINATED";

/** EmployeeListSerializer: the light representation used in lists. */
export interface EmployeeListItem {
    id: number;
    matricule: string;
    first_name: string;
    last_name: string;
    work_email: string | null;
    department: number;
    department_name: string;
    position: number;
    position_title: string;
    employment_status: EmploymentStatus;
    hire_date: string;
    has_photo: boolean;
}