/**
 * The access token lives in memory only: never in localStorage/sessionStorage.
 * After a page reload it is restored from the HttpOnly refresh cookie.
 */
let accessToken: string | null = null;

export const getAccessToken = () => accessToken;
export const setAccessToken = (token: string) => {
    accessToken = token;
};
export const clearAccessToken = () => {
    accessToken = null;
};