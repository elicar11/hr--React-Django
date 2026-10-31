export type PayslipStatus = "DRAFT" | "CALCULATED" | "VALIDATED" | "PAID" | "CANCELLED";
export type PeriodStatus = "OPEN" | "CLOSED";
export type PaymentMethod = "BANK_TRANSFER" | "MOBILE_MONEY" | "CASH" | "OTHER";

export type PayItemCategory =
    | "BASE_SALARY"
    | "OVERTIME"
    | "BONUS"
    | "ALLOWANCE"
    | "BENEFIT"
    | "ABSENCE"
    | "CONTRIBUTION"
    | "TAX"
    | "DEDUCTION";

export type PayItemCalculation =
    | "FIXED"
    | "PERCENT_OF_BASE"
    | "PERCENT_OF_GROSS"
    | "SYSTEM_BASE_SALARY"
    | "SYSTEM_OVERTIME"
    | "SYSTEM_UNPAID_LEAVE";

/** Amounts, rates and hours are decimal strings: never calculate with them on the client. */
export interface PayrollSettings {
    currency: string;
    country: string;
    is_demo: boolean;
    demo_warning: string | null;
    monthly_hours: string | null;
    overtime_multiplier: string | null;
    prorate_partial_periods: boolean;
    updated_at: string;
}

export interface PayrollSettingsInput {
    currency: string;
    country: string;
    monthly_hours: string | null;
    overtime_multiplier: string | null;
    prorate_partial_periods: boolean;
}

export interface PayItemType {
    id: number;
    code: string;
    name: string;
    category: PayItemCategory;
    calculation: PayItemCalculation;
    default_amount: string | null;
    default_rate: string | null;
    applies_to_all: boolean;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface PayItemTypeInput {
    code: string;
    name: string;
    category: PayItemCategory;
    calculation: PayItemCalculation;
    default_amount: string | null;
    default_rate: string | null;
    applies_to_all: boolean;
    is_active: boolean;
}

/** Recurring remuneration element of an employee. */
export interface PayElement {
    id: number;
    employee: number;
    employee_matricule: string;
    item_type: number;
    item_type_code: string;
    item_type_name: string;
    amount: string | null;
    rate: string | null;
    start_date: string;
    end_date: string | null;
    created_at: string;
}

export interface PayElementInput {
    employee: number;
    item_type: number;
    amount: string | null;
    rate: string | null;
    start_date: string;
    end_date: string | null;
}

export interface PayrollPeriod {
    id: number;
    code: string;
    name: string;
    start_date: string;
    end_date: string;
    status: PeriodStatus;
    closed_at: string | null;
    payslips_count?: number;
    total_gross?: string;
    total_deductions?: string;
    total_net?: string;
    created_at: string;
}

export interface PayrollPeriodInput {
    code: string;
    name: string;
    start_date: string;
    end_date: string;
}

/** PayslipListSerializer. */
export interface PayslipListItem {
    id: number;
    reference: string;
    revision: number;
    employee: number;
    employee_matricule: string;
    employee_name: string;
    period: number;
    period_code: string;
    status: PayslipStatus;
    currency: string;
    gross_pay: string;
    total_deductions: string;
    net_pay: string;
    is_demo: boolean;
    demo_warning: string | null;
}

export interface PayslipLine {
    id: number;
    code: string;
    label: string;
    category: PayItemCategory;
    base_amount: string | null;
    rate: string | null;
    quantity: string | null;
    amount: string;
    note: string;
    is_manual: boolean;
}

export interface Payment {
    method: PaymentMethod;
    payment_date: string;
    amount: string;
}

/** What the calculation engine used (ADMIN / HR only). */
export interface CalculationContext {
    settings?: {
        currency?: string;
        is_demo?: boolean;
        monthly_hours?: string | null;
        overtime_multiplier?: string | null;
        prorate_partial_periods?: boolean;
    };
    contracts?: string[];
    working_days_in_period?: number;
    overtime_minutes?: number;
    unpaid_leave_days?: number;
}

export interface Payslip extends PayslipListItem {
    department_name: string;
    period_start: string;
    period_end: string;
    validated_at: string | null;
    lines: PayslipLine[];
    payment?: Payment;
    // ADMIN / HR only:
    calculation_context?: CalculationContext;
    calculated_at?: string | null;
    calculated_by?: number | null;
    validated_by?: number | null;
    cancelled_at?: string | null;
    cancelled_by?: number | null;
    cancel_reason?: string;
}

export interface PayslipHistoryEntry {
    id: number;
    created_at: string;
    action: "CREATED" | "CALCULATED" | "LINE_ADDED" | "LINE_REMOVED" | "VALIDATED" | "PAID" | "CANCELLED";
    actor_email: string;
    from_status: string;
    to_status: string;
    comment: string;
}

export interface BulkError {
    reference: string;
    matricule: string;
    detail: string;
}

export interface GenerateResult {
    created: number;
    skipped_without_contract: string[];
}

export interface CalculateResult {
    calculated: number;
    errors: BulkError[];
}

export interface ValidateResult {
    validated: number;
    errors: BulkError[];
}