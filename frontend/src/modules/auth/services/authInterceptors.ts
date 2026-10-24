import { ApiError, api } from "@/lib/api";
import { refreshAccessToken } from "./refreshAccessToken";
import { getAccessToken } from "../tokenStore";

let onSessionExpired: (() => void) | null = null;

/** Registered by AuthProvider: called when the session cannot be renewed anymore. */
export function setSessionExpiredHandler(handler: (() => void) | null) {
    onSessionExpired = handler;
}

const requestId = api.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Runs after the error normalizer of lib/api/client.ts: errors are ApiError here.
const responseId = api.interceptors.response.use(undefined, async (error: unknown) => {
    if (!(error instanceof ApiError) || error.status !== 401 || !error.config) throw error;

    const original = error.config;
    if (original.skipAuthRefresh || original._retry) throw error;

    let token: string;
    try {
        token = await refreshAccessToken();
    } catch (refreshError) {
        // Only a refused refresh ends the session; a network failure does not log the user out.
        if (refreshError instanceof ApiError && refreshError.status === 401) onSessionExpired?.();
        throw error;
    }

    original._retry = true;
    original.headers.Authorization = `Bearer ${token}`;
    return api.request(original);
});

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        api.interceptors.request.eject(requestId);
        api.interceptors.response.eject(responseId);
    });
}