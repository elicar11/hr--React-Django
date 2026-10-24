import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { toApiError } from "@/lib/api";

/**
 * Puts the API validation errors on the matching form fields.
 * Returns the messages that belong to no field (to show in an alert).
 */
export function applyApiErrors<T extends FieldValues>(
    error: unknown,
    setError: UseFormSetError<T>,
    fields: readonly Path<T>[],
): string[] {
    const apiError = toApiError(error);
    const entries = Object.entries(apiError.fieldErrors);
    if (apiError.code !== "validation_error" || entries.length === 0) return [apiError.message];

    const leftovers: string[] = [];
    for (const [field, messages] of entries) {
        const match = fields.find((name) => name === field);
        if (match) setError(match, { type: "server", message: messages.join(" ") });
        else leftovers.push(...messages);
    }
    return leftovers;
}