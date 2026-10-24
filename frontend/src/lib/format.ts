const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });
const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

function parse(value: string): Date {
    // "2026-03-14" (date only) must not shift with the time zone.
    return value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
}

export function formatDate(value: string | null | undefined): string {
    if (!value) return "";
    const date = parse(value);
    return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
}

export function formatDateTime(value: string | null | undefined): string {
    if (!value) return "";
    const date = parse(value);
    return Number.isNaN(date.getTime()) ? value : dateTimeFormat.format(date);
}