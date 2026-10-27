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

/** ContractSerializer. `base_salary` is a decimal string. */
export interface Contract extends ContractListItem {
    probation_days: number | null;
    base_salary: string;
    currency: string;
    signed_date: string | null;
    renews: number | null;
    renewed_by: number | null;
    created_at: string;
    updated_at: string;
}

export interface ContractInput {
    employee: number;
    contract_type: number;
    reference: string;
    start_date: string;
    end_date: string | null;
    position: number;
    probation_days: number | null;
    base_salary: string;
    currency: string;
}

/** The renewal is sent in full: every field is explicit. */
export interface RenewInput {
    reference: string;
    start_date: string;
    end_date: string | null;
    contract_type: number;
    position: number;
    base_salary: string;
    currency: string;
    probation_days: number | null;
}

export interface ContractType {
    id: number;
    code: string;
    name: string;
    description: string;
    is_fixed_term: boolean;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface ContractTypeInput {
    code: string;
    name: string;
    description: string;
    is_fixed_term: boolean;
    is_active: boolean;
}

export interface ContractDocument {
    id: number;
    title: string;
    size: number;
    created_at: string;
}

export interface ContractHistoryEntry {
    id: number;
    created_at: string;
    actor_email: string;
    action: string;
    metadata: Record<string, unknown>;
}