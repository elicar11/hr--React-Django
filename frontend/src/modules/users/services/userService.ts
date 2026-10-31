import { api, fetchAllPages, fetchPage, type Page } from "@/lib/api";
import type { User } from "@/modules/auth/types";
import type { UserCreateInput, UserSummary, UserUpdateInput } from "../types";

export type ListQuery = Record<string, string | number | undefined>;

/** ADMIN only: the API refuses the account list to everyone else. */
export function listUsers(params: ListQuery, signal?: AbortSignal): Promise<Page<User>> {
    return fetchPage<User>("/users/", params, signal);
}

/** Active accounts (all pages): for select boxes. */
export function getAllActiveUsers(signal?: AbortSignal): Promise<User[]> {
    return fetchAllPages<User>("/users/", { is_active: "true" }, signal);
}

export async function createUser(input: UserCreateInput): Promise<UserSummary> {
    const { data } = await api.post<UserSummary>("/users/", input);
    return data;
}

export async function updateUser(id: number, input: UserUpdateInput): Promise<User> {
    const { data } = await api.patch<User>(`/users/${id}/`, input);
    return data;
}

/** Deactivating revokes every session of the account. */
export async function setUserActive(id: number, active: boolean): Promise<User> {
    const { data } = await api.post<User>(`/users/${id}/${active ? "activate" : "deactivate"}/`);
    return data;
}