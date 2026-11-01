import i18n from "@/i18n";

/** UI language -> formatting locale. English uses en-GB to keep the day-first order (14 Mar 2026). */
export function currentLocale(): string {
    return i18n.language === "en" ? "en-GB" : "fr-FR";
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function dateFormatter(name: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    const locale = currentLocale();
    const key = `${locale}:${name}`;
    let formatter = formatters.get(key);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat(locale, options);
        formatters.set(key, formatter);
    }
    return formatter;
}

function parse(value: string): Date {
    // "2026-03-14" (date only) must not shift with the time zone.
    return value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
}

function format(name: string, options: Intl.DateTimeFormatOptions, value: string | null | undefined): string {
    if (!value) return "";
    const date = parse(value);
    return Number.isNaN(date.getTime()) ? value : dateFormatter(name, options).format(date);
}

export const formatDate = (value: string | null | undefined) => format("date", { dateStyle: "medium" }, value);
export const formatLongDate = (value: string | null | undefined) => format("long", { dateStyle: "full" }, value);
export const formatDateTime = (value: string | null | undefined) =>
    format("datetime", { dateStyle: "medium", timeStyle: "short" }, value);
export const formatTime = (value: string | null | undefined) => format("time", { timeStyle: "short" }, value);

/** "2026-03" -> "mars 26" (fr) / "Mar 26" (en) */
export function formatMonth(value: string): string {
    const date = new Date(`${value}-01T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : dateFormatter("month", { month: "short", year: "2-digit" }).format(date);
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
    return Number.isNaN(number) ? value : number.toLocaleString(currentLocale(), { maximumFractionDigits });
}

/** Display only. Amounts are never computed on the client. */
export function formatMoney(amount: string, currency: string): string {
    if (!currency) return formatDecimal(amount); // no currency yet (draft payslip, unconfigured payroll)
    try {
        return new Intl.NumberFormat(currentLocale(), { style: "currency", currency }).format(Number(amount));
    } catch {
        return `${amount} ${currency}`; // unknown currency code
    }
}

/** Today as "YYYY-MM-DD" in the browser's time zone (default value of date fields). */
export function todayISO(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
}

/** "2026-03-14" + 1 -> "2026-03-15" (local calendar days). */
export function addDaysISO(value: string, days: number): string {
    const date = new Date(`${value}T00:00:00`);
    date.setDate(date.getDate() + days);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
}

/** 1536 -> "1,5 ko" (fr) / "1.5 KB" (en) */
export function formatFileSize(bytes: number): string {
    const english = i18n.language === "en";
    if (bytes < 1024) return `${bytes} ${english ? "B" : "o"}`;
    const kilobytes = bytes / 1024;
    const locale = currentLocale();
    if (kilobytes < 1024) {
        return `${kilobytes.toLocaleString(locale, { maximumFractionDigits: 1 })} ${english ? "KB" : "ko"}`;
    }
    return `${(kilobytes / 1024).toLocaleString(locale, { maximumFractionDigits: 1 })} ${english ? "MB" : "Mo"}`;
}

/** First day of the current month as "YYYY-MM-DD". */
export function firstOfMonthISO(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Value of an <input type="datetime-local"> ("2026-10-26T08:05") to an ISO date-time with time zone. */
export function localDateTimeToISO(value: string): string {
    return new Date(value).toISOString();
}

/** ISO date-time from the API to the value expected by <input type="datetime-local">. */
export function isoToLocalInput(value: string | null): string {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (number: number) => String(number).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** "2026-10-28" -> ISO date-time of the start of that day in the browser's time zone. */
export function startOfDayISO(value: string): string {
    return new Date(`${value}T00:00:00`).toISOString();
}

/** "2026-10-28" -> ISO date-time of the last millisecond of that day. */
export function endOfDayISO(value: string): string {
    return new Date(`${value}T23:59:59.999`).toISOString();
}