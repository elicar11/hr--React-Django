import axios from "axios";
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
  (error: unknown) => Promise.reject(toApiError(error)),
);