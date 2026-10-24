import * as authService from "../services/authService";
import { setAccessToken } from "../tokenStore";

let inFlight: Promise<string> | null = null;

/**
 * One refresh at a time. The backend rotates refresh tokens: two parallel refreshes
 * would invalidate each other. All callers share the same promise.
 */
export function refreshAccessToken(): Promise<string> {
    inFlight ??= authService
        .refresh()
        .then((token) => {
            setAccessToken(token);
            return token;
        })
        .finally(() => {
            inFlight = null;
        });
    return inFlight;
}