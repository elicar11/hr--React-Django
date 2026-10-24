import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api";

/** Single entry point for user notifications. */
export const notify = {
    success(message: string, description?: string) {
        toast.success(message, { description });
    },
    info(message: string, description?: string) {
        toast(message, { description });
    },
    /** Accepts any error: the standard API message is extracted. */
    error(error: unknown, title = "Une erreur est survenue") {
        toast.error(title, { description: getErrorMessage(error) });
    },
};