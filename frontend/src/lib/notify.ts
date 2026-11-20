import { toast } from "sonner";
import { toApiError } from "@/lib/api";
import { tr } from "@/i18n/translate";

/** Single entry point for user notifications. */
export const notify = {
    success(message: string, description?: string) {
        toast.success(tr(message), { description: tr(description) });
    },
    info(message: string, description?: string) {
        toast(tr(message), { description: tr(description) });
    },
    /**
     * Accepts any error. Without a title, the real message of the error is the title; unexpected errors
     * (server down, internal error...) add what was called and what the server answered.
     */
    error(error: unknown, title?: string) {
        const apiError = toApiError(error);
        const technical = apiError.technical;
        if (title) {
            toast.error(tr(title), { description: technical ? `${apiError.message} (${technical})` : apiError.message, duration: technical ? 10_000 : undefined });
        } else {
            toast.error(apiError.message, { description: technical, duration: technical ? 10_000 : undefined });
        }
    },
};