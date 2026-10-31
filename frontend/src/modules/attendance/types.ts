export type AttendanceStatus = "PRESENT" | "ABSENT_JUSTIFIED" | "ABSENT_UNJUSTIFIED";
export type CorrectionStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type AttendanceSource = "CLOCK" | "MANUAL" | "SYSTEM";

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

export interface TodayOverview {
    date: string;
    is_working_day: boolean;
    schedule: WorkSchedule | null;
    record: AttendanceRecord | null;
}

/** One row of GET /attendance/summary/. */
export interface AttendanceSummaryRow {
    employee_id: number;
    matricule: string;
    last_name: string;
    first_name: string;
    days_present: number;
    days_absent_justified: number;
    days_absent_unjustified: number;
    late_count: number;
    total_late_minutes: number;
    total_worked_minutes: number;
    total_overtime_minutes: number;
}

export interface AttendanceWriteInput {
    employee: number;
    date: string;
    status: AttendanceStatus;
    check_in: string | null;
    check_out: string | null;
    absence_reason: string;
}

export type AttendanceUpdateInput = Partial<Omit<AttendanceWriteInput, "employee" | "date">>;

export interface CorrectionRequestInput {
    date: string;
    check_in: string;
    check_out: string | null;
    reason: string;
}

export interface WorkScheduleInput {
    code: string;
    name: string;
    start_time: string;
    end_time: string;
    break_start: string | null;
    break_end: string | null;
    working_days: number[];
    late_grace_minutes: number;
    overtime_threshold_minutes: number;
}

export interface ScheduleAssignment {
    id: number;
    employee: number;
    employee_matricule: string;
    schedule: number;
    schedule_code: string;
    start_date: string;
    end_date: string | null;
}

export interface Holiday {
    id: number;
    date: string;
    name: string;
}