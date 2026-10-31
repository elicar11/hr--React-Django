/** 0 = Monday ... 6 = Sunday, as in the backend. */
export const WEEKDAYS = [
    { id: 0, long: "Lundi", short: "Lun" },
    { id: 1, long: "Mardi", short: "Mar" },
    { id: 2, long: "Mercredi", short: "Mer" },
    { id: 3, long: "Jeudi", short: "Jeu" },
    { id: 4, long: "Vendredi", short: "Ven" },
    { id: 5, long: "Samedi", short: "Sam" },
    { id: 6, long: "Dimanche", short: "Dim" },
] as const;

export function formatWorkingDays(days: number[]): string {
    return WEEKDAYS.filter((day) => days.includes(day.id))
        .map((day) => day.short)
        .join(" ");
}