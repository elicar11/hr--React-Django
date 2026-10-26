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

/** EmployeeSerializer: the full record. */
export interface Employee {
    id: number;
    matricule: string;
    last_name: string;
    first_name: string;
    date_of_birth: string;
    work_email: string | null;
    personal_email: string;
    work_phone: string;
    personal_phone: string;
    address_line: string;
    postal_code: string;
    city: string;
    hire_date: string;
    department: number;
    department_name: string;
    position: number;
    position_title: string;
    employment_status: EmploymentStatus;
    departure_date: string | null;
    has_photo: boolean;
    user: number | null;
    created_at: string;
    updated_at: string;
}

/** Editable personal data (assignment and status have their own actions). */
export interface EmployeeInput {
    matricule: string;
    last_name: string;
    first_name: string;
    date_of_birth: string;
    work_email: string | null;
    personal_email: string;
    work_phone: string;
    personal_phone: string;
    address_line: string;
    postal_code: string;
    city: string;
    hire_date: string;
    /** Only sent by an ADMIN. */
    user?: number | null;
}

export interface EmployeeCreateInput extends EmployeeInput {
    department: number;
    position: number;
}

export interface Assignment {
    id: number;
    department: number;
    department_name: string;
    position: number;
    position_title: string;
    start_date: string;
    end_date: string | null;
}

export interface AssignInput {
    department: number;
    position: number;
    start_date: string;
}

export interface EmployeeHistoryEntry {
    id: number;
    created_at: string;
    actor_email: string;
    action: string;
    metadata: Record<string, unknown>;
}

export interface ImportRowError {
    line: number;
    errors: Record<string, string[]>;
}

/** Answer of a `dry_run` import: nothing was written. */
export interface ImportPreview {
    dry_run: true;
    rows: number;
    valid: boolean;
    invalid_rows: number;
    errors: ImportRowError[];
    ignored_columns: string[];
}

export interface ImportOutcome {
    created: number;
    ignored_columns: string[];
}