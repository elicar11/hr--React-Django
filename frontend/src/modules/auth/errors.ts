import type { ApiError } from "@/lib/api";
import i18n from "@/i18n";

/** Seconds to wait, as sent by the API on a 429 (`details.retry_after`). */
export function retryAfterSeconds(error: ApiError): number | undefined {
    const details = error.details;
    if (details && typeof details === "object" && "retry_after" in details) {
        const value = (details as { retry_after: unknown }).retry_after;
        return typeof value === "number" ? value : undefined;
    }
    return undefined;
}

export function throttleMessage(error: ApiError): string {
    const seconds = retryAfterSeconds(error);
    return seconds
        ? i18n.t("Trop de tentatives. Réessayez dans {{count}} seconde", { count: seconds })
        : i18n.t("Trop de tentatives. Réessayez dans quelques instants.");
}
