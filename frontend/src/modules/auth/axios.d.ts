import "axios";

declare module "axios" {
    export interface AxiosRequestConfig {
        /** Do not try to refresh the access token if this request answers 401 (login, refresh...). */
        skipAuthRefresh?: boolean;
        /** Internal: the request was already replayed after a refresh. */
        _retry?: boolean;
    }
}