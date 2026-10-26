import axios, { AxiosError } from "axios";
import { toApiError } from "./errors";

/** Configurable through VITE_API_URL; relative by default (Vite proxies it to Django in development). */
export const API_URL = import.meta.env.VITE_API_URL ?? "/api/v1";

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // the refresh token travels in an HttpOnly cookie
  headers: { Accept: "application/json" },
  timeout: 30_000,
});

// Uniform error handling: components only ever see ApiError.
api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    // A failed download answers with a JSON error body, but wrapped in a Blob: unwrap it first.
    if (error instanceof AxiosError && error.response?.data instanceof Blob && error.response.data.type.includes("json")) {
      try {
        error.response.data = JSON.parse(await error.response.data.text());
      } catch {
        // keep the generic message
      }
    }
    throw toApiError(error);
  },
);