export type ClassValue = string | false | null | undefined;

/** Joins class names, ignoring falsy values. */
export function cx(...values: ClassValue[]): string {
    return values.filter(Boolean).join(" ");
}