import type { Gender } from "./types";

export const GENDER_LABELS: Record<Gender, string> = { M: "Homme", F: "Femme" };

/** "101 011 123456" -> "101011123456": separators are removed before sending. */
export function normalizeCin(value: string): string {
    return value.replace(/[\s.-]/g, "");
}

/** "101011123456" -> "101 011 123456" (3 geographic + 3 sex marker + 6 register number). */
export function formatCin(value: string | null): string {
    if (!value) return "";
    return /^[0-9]{12}$/.test(value) ? `${value.slice(0, 3)} ${value.slice(3, 6)} ${value.slice(6)}` : value;
}