export type PayslipStatus = "DRAFT" | "CALCULATED" | "VALIDATED" | "PAID" | "CANCELLED";

/** PayslipListSerializer. Amounts are decimal strings. */
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

/** Recurring remuneration element of an employee. Amounts and rates are decimal strings. */
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