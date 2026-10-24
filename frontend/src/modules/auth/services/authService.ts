import { api } from "@/lib/api";
import type { User } from "../types";

export interface LoginResponse {
    access: string;
    user: User;
}

// skipAuthRefresh: these calls must never trigger the automatic token refresh.
export async function login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>("/auth/login/", { email, password }, { skipAuthRefresh: true });
    return data;
}

/** Uses the HttpOnly cookie: no body. Returns the new access token. */
export async function refresh(): Promise<string> {
    const { data } = await api.post<{ access: string }>("/auth/refresh/", null, { skipAuthRefresh: true });
    return data.access;
}

export async function logout(): Promise<void> {
    await api.post("/auth/logout/", null, { skipAuthRefresh: true });
}

export async function fetchMe(): Promise<User> {
    const { data } = await api.get<User>("/auth/me/");
    return data;
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await api.post("/auth/change-password/", { old_password: oldPassword, new_password: newPassword });
}

/** The API always answers the same thing, whether the account exists or not. */
export async function requestPasswordReset(email: string): Promise<void> {
    await api.post("/auth/password-reset/", { email }, { skipAuthRefresh: true });
}

export async function confirmPasswordReset(uid: string, token: string, newPassword: string): Promise<void> {
    await api.post(
        "/auth/password-reset/confirm/",
        { uid, token, new_password: newPassword },
        { skipAuthRefresh: true },
    );
}