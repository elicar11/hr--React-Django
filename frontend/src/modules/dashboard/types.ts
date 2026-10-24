import type { AttendanceCorrection, AttendanceRecord, WorkSchedule } from "@/modules/attendance/types";
import type { EmployeeListItem, EmploymentStatus } from "@/modules/employees/types";
import type { LeaveBalance, LeaveRequest } from "@/modules/leaves/types";
import type { PayslipListItem } from "@/modules/payroll/types";

export interface DashboardFilters {
    date_from?: string;
    date_to?: string;
    department?: string;
    status?: string;
}

export interface HrKpis {
    active_employees: number;
    suspended_employees: number;
    hires_in_period: number;
    departures_in_period: number;
    contracts_expiring_soon: number;
    contracts_overdue: number;
    contract_alert_days: number;
    present_today: number;
    absent_today: number;
    on_leave_today: number;
    pending_leave_requests: number;
}

export interface MonthlyMovement {
    month: string; // "2026-03"
    hires: number;
    departures: number;
}

export interface Deadline {
    type: "CONTRACT_END" | "PROBATION_END";
    date: string;
    employee_id: number;
    matricule: string;
    employee_name: string;
    reference: string;
}

export interface ActivityEntry {
    id: number;
    created_at: string;
    actor_email: string;
    action: string;
    target_type: string;
    target_id: string;
}

export interface HrDashboard {
    generated_at: string;
    filters: {
        date_from: string;
        date_to: string;
        department: number | null;
        status: EmploymentStatus | null;
    };
    kpis: HrKpis;
    headcount_by_department: { department_id: number; code: string; name: string; count: number }[];
    headcount_by_position: { position_id: number; code: string; title: string; count: number }[];
    contracts_by_type: { contract_type_id: number; code: string; name: string; count: number }[];
    monthly_movements: MonthlyMovement[];
    deadlines: Deadline[];
    recent_activity: ActivityEntry[];
}

export interface EmployeeDashboard {
    employee: EmployeeListItem;
    today: {
        date: string;
        is_working_day: boolean;
        schedule: WorkSchedule | null;
        record: AttendanceRecord | null;
    };
    leave_balances: LeaveBalance[];
    pending_leave_requests: number;
    next_leave: LeaveRequest | null;
    latest_payslip: PayslipListItem | null;
    recent_leave_requests: LeaveRequest[];
    recent_corrections: AttendanceCorrection[];
}