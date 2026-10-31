import type { Holiday } from "@/modules/attendance/types";

export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type DayCountMode = "WORKING_DAYS" | "CALENDAR_DAYS";

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

export interface LeaveType {
    id: number;
    code: string;
    name: string;
    description: string;
    day_count_mode: DayCountMode;
    uses_balance: boolean;
    annual_allowance: string | null;
    requires_document: boolean;
    is_paid: boolean;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface LeaveTypeInput {
    code: string;
    name: string;
    description: string;
    day_count_mode: DayCountMode;
    uses_balance: boolean;
    annual_allowance: string | null;
    requires_document: boolean;
    is_paid: boolean;
    is_active: boolean;
}

/** `employee` is only sent by ADMIN / HR requesting on behalf of someone. */
export interface LeaveRequestInput {
    employee?: number;
    leave_type: number;
    start_date: string;
    end_date: string;
    reason: string;
}

export interface LeaveBalanceCreateInput {
    employee: number;
    leave_type: number;
    year: number;
    allocated: string;
}

export interface LeaveDocument {
    id: number;
    title: string;
    size: number;
    created_at: string;
}

export interface LeaveHistoryEntry {
    id: number;
    created_at: string;
    action: "CREATED" | "UPDATED" | "APPROVED" | "REJECTED" | "CANCELLED";
    actor_email: string;
    from_status: string;
    to_status: string;
    comment: string;
}

export interface LeaveCalendar {
    leaves: LeaveRequest[];
    holidays: Holiday[];
}