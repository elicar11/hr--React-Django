const pad = (value: number) => String(value).padStart(2, "0");

export function toISO(date: Date): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "2026-10" */
export function currentMonthKey(): string {
    return toISO(new Date()).slice(0, 7);
}

export function shiftMonth(key: string, delta: number): string {
    const [year, month] = key.split("-").map(Number);
    return toISO(new Date(year, month - 1 + delta, 1)).slice(0, 7);
}

const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
export function formatMonthLong(key: string): string {
    return monthLabel.format(new Date(`${key}-01T00:00:00`));
}

/** Weeks (Monday first) covering the month, as ISO dates. Days of neighbouring months are included. */
export function monthGrid(key: string): string[][] {
    const [year, month] = key.split("-").map(Number);
    const offset = (new Date(year, month - 1, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month, 0).getDate();
    const total = Math.ceil((offset + daysInMonth) / 7) * 7;
    const weeks: string[][] = [];
    for (let index = 0; index < total; index += 7) {
        weeks.push(
            Array.from({ length: 7 }, (_, day) => toISO(new Date(year, month - 1, 1 - offset + index + day))),
        );
    }
    return weeks;
}