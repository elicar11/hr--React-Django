import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { ApiErrorBody } from "./types";

function messages(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(messages);
  if (value && typeof value === "object") return Object.values(value).flatMap(messages);
  return [];
}

function flattenDetails(details: unknown): Record<string, string[]> {
  if (!details || typeof details !== "object" || Array.isArray(details)) return {};
  const result: Record<string, string[]> = {};
  for (const [field, value] of Object.entries(details)) {
    const list = messages(value);
    if (list.length > 0) result[field] = list;
  }
  return result;
}

/** Every failed request becomes an ApiError, whatever its cause (HTTP error, network, timeout). */
export class ApiError extends Error {
  status: number;
  code: string;
  details: unknown;
  /** Original request, so that an interceptor can retry it (token refresh). */
  config?: InternalAxiosRequestConfig;

  constructor(
    message: string,
    status: number,
    code: string,
    details?: unknown,
    config?: InternalAxiosRequestConfig,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.config = config;
  }

  /** Field-level messages of a validation error, e.g. { email: ["Ce champ est obligatoire."] }. */
  get fieldErrors(): Record<string, string[]> {
    return flattenDetails(this.details);
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof AxiosError) {
    const body = error.response?.data as Partial<ApiErrorBody> | undefined;
    if (error.response && body?.error) {
      const { code, message, status, details } = body.error;
      return new ApiError(message, status ?? error.response.status, code, details, error.config);
    }
    if (error.response) {
      return new ApiError("Une erreur est survenue.", error.response.status, "http_error", undefined, error.config);
    }
    if (error.code === "ECONNABORTED") {
      return new ApiError("Le serveur met trop de temps à répondre.", 0, "timeout", undefined, error.config);
    }
    return new ApiError("Impossible de joindre le serveur.", 0, "network_error", undefined, error.config);
  }

  return new ApiError("Une erreur inattendue est survenue.", 0, "unknown_error");
}

export function getErrorMessage(error: unknown): string {
  return toApiError(error).message;
}