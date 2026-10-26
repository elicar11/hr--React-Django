import { fetchAllPages } from "@/lib/api";
import type { User } from "@/modules/auth/types";

/** Active accounts (ADMIN only: the API refuses this list to the others). */
export function getAllActiveUsers(signal?: AbortSignal): Promise<User[]> {
    return fetchAllPages<User>("/users/", { is_active: "true" }, signal);
}