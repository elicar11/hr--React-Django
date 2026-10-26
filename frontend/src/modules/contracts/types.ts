export type ContractStatus = "DRAFT" | "ACTIVE" | "ENDED" | "TERMINATED";

/** ContractListSerializer: no salary in lists. */
export interface ContractListItem {
    id: number;
    reference: string;
    employee: number;
    employee_matricule: string;
    employee_name: string;
    contract_type: number;
    contract_type_name: string;
    position: number;
    position_title: string;
    start_date: string;
    end_date: string | null;
    status: ContractStatus;
    days_remaining: number | null;
}