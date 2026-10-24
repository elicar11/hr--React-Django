export type AttendanceStatus = "PRESENT" | "ABSENT_JUSTIFIED" | "ABSENT_UNJUSTIFIED";
export type CorrectionStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface WorkSchedule {
    id: number;
    code: string;
    name: string;
    start_time: string; // "08:00:00"
    end_time: string;
    break_start: string | null;
    break_end: string | null;
    working_days: number[]; // 0 = Monday ... 6 = Sunday
    late_grace_minutes: number;
    overtime_threshold_minutes: number;
    is_default: boolean;
    created_at: string;
    updated_at: string;
}

export interface AttendanceRecord {
    id: number;
    employee: number;
    employee_matricule: string;
    employee_name: string;
    department_name: string;
    date: string;
    status: AttendanceStatus;
    source: "CLOCK" | "MANUAL" | "SYSTEM";
    check_in: string | null;
    check_out: string | null;
    worked_minutes: number;
    late_minutes: number;
    overtime_minutes: number;
    absence_reason: string;
    schedule: number | null;
    schedule_code: string | null;
    created_at: string;
    updated_at: string;
}

export interface AttendanceCorrection {
    id: number;
    employee: number;
    employee_matricule: string;
    employee_name: string;
    date: string;
    check_in: string;
    check_out: string | null;
    reason: string;
    status: CorrectionStatus;
    requested_by: number | null;
    decided_by: number | null;
    decided_at: string | null;
    decision_comment: string;
    created_at: string;
}