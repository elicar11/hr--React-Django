import type { PayItemCalculation, PayItemCategory, PaymentMethod } from "./types";

export const CATEGORY_LABELS: Record<PayItemCategory, string> = {
    BASE_SALARY: "Salaire de base",
    OVERTIME: "Heures supplémentaires",
    BONUS: "Prime",
    ALLOWANCE: "Indemnité",
    BENEFIT: "Avantage",
    ABSENCE: "Retenue sur absence",
    CONTRIBUTION: "Cotisation sociale",
    TAX: "Impôt / prélèvement",
    DEDUCTION: "Autre retenue",
};

export const CALCULATION_LABELS: Record<PayItemCalculation, string> = {
    FIXED: "Montant fixe",
    PERCENT_OF_BASE: "% du salaire de base",
    PERCENT_OF_GROSS: "% du brut",
    SYSTEM_BASE_SALARY: "Calculé : salaire de base",
    SYSTEM_OVERTIME: "Calculé : heures supplémentaires",
    SYSTEM_UNPAID_LEAVE: "Calculé : congé sans solde",
};

/** The category an engine-computed calculation requires. */
export const SYSTEM_CATEGORY: Partial<Record<PayItemCalculation, PayItemCategory>> = {
    SYSTEM_BASE_SALARY: "BASE_SALARY",
    SYSTEM_OVERTIME: "OVERTIME",
    SYSTEM_UNPAID_LEAVE: "ABSENCE",
};

export const METHOD_LABELS: Record<PaymentMethod, string> = {
    BANK_TRANSFER: "Virement bancaire",
    MOBILE_MONEY: "Mobile money",
    CASH: "Espèces",
    OTHER: "Autre",
};

export function isSystemCalculation(calculation: PayItemCalculation): boolean {
    return calculation in SYSTEM_CATEGORY;
}

export type LineKind = "earning" | "adjustment" | "deduction";

/** Gains add to the gross, absence lines reduce it, the rest are deductions from the gross. */
export function lineKind(category: PayItemCategory): LineKind {
    if (category === "ABSENCE") return "adjustment";
    if (category === "CONTRIBUTION" || category === "TAX" || category === "DEDUCTION") return "deduction";
    return "earning";
}