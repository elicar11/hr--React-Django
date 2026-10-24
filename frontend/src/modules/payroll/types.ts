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