/** Format check of an amount typed by the user (guides the typing; the API validates). */
export const DECIMAL_PATTERN = /^\d+([.,]\d{1,2})?$/;

/** "7,5" -> "7.5": amounts travel as decimal strings, never as floats. */
export function toDecimalString(value: string): string {
    return value.trim().replace(",", ".");
}

/** Rate in percent, up to 4 decimals (e.g. "12,5" or "7.2500"). */
export const RATE_PATTERN = /^\d+([.,]\d{1,4})?$/;