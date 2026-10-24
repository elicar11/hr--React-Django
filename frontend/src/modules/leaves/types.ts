export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

/** Decimals are strings: never calculate with them on the client. */
export interface LeaveBalance {
    id: number;
    employee: number;
    employee_matricule: string;
    employee_name: string;
    leave_type: number;
    leave_type_name: string;
    year: number;
    allocated: string;
    used: string;
    remaining: string;
    updated_at: string;
}

export interface LeaveRequest {
    id: number;
    employee: number;
    employee_matricule: string;
    employee_name: string;
    department_name: string;
    leave_type: number;
    leave_type_name: string;
    start_date: string;
    end_date: string;
    days: string;
    days_by_year: Record<string, string>;
    reason: string;
    status: LeaveStatus;
    requested_by: number | null;
    decided_by: number | null;
    decided_at: string | null;
    decision_comment: string;
    documents_count: number;
    created_at: string;
    updated_at: string;
}