const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });
const longDateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" });
const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const timeFormat = new Intl.DateTimeFormat("fr-FR", { timeStyle: "short" });
const monthFormat = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" });

function parse(value: string): Date {
    // "2026-03-14" (date only) must not shift with the time zone.
    return value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
}

function format(formatter: Intl.DateTimeFormat, value: string | null | undefined): string {
    if (!value) return "";
    const date = parse(value);
    return Number.isNaN(date.getTime()) ? value : formatter.format(date);
}

export const formatDate = (value: string | null | undefined) => format(dateFormat, value);
export const formatLongDate = (value: string | null | undefined) => format(longDateFormat, value);
export const formatDateTime = (value: string | null | undefined) => format(dateTimeFormat, value);
export const formatTime = (value: string | null | undefined) => format(timeFormat, value);

/** "2026-03" -> "mars 26" */
export function formatMonth(value: string): string {
    const date = new Date(`${value}-01T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : monthFormat.format(date);
}

/** 75 -> "1 h 15", 35 -> "35 min" */
export function formatMinutes(total: number): string {
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    if (hours === 0) return `${minutes} min`;
    return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, "0")}`;
}

/** Decimal strings from the API ("7.50") shown as "7,5". Display only: never calculate with the result. */
export function formatDecimal(value: string, maximumFractionDigits = 2): string {
    const number = Number(value);
    return Number.isNaN(number) ? value : number.toLocaleString("fr-FR", { maximumFractionDigits });
}

/** Display only. Amounts are never computed on the client. */
export function formatMoney(amount: string, currency: string): string {
    try {
        return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(Number(amount));
    } catch {
        return `${amount} ${currency}`; // unknown currency code
    }
}