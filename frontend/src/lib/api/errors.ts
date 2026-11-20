import { AxiosError, type InternalAxiosRequestConfig } from "axios";
import i18n from "@/i18n";
import { translateApiMessage } from "@/i18n/translate";
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
    if (list.length > 0) result[field] = list.map(translateApiMessage);
  }
  return result;
}

// --- Diagnosis: what was called and what the server really answered ------------------------------------------------

const MAX_TECHNICAL = 400;
const clip = (text: string) => (text.length > MAX_TECHNICAL ? `${text.slice(0, MAX_TECHNICAL)}…` : text);

function clean(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Text of an answer that is not the usual JSON: the Django debug page exposes the exception, other pages their title. */
function bodyText(data: unknown): string {
  if (typeof data === "string") {
    const title = /<title>([\s\S]*?)<\/title>/i.exec(data)?.[1];
    const exception = /<pre class="exception_value">([\s\S]*?)<\/pre>/i.exec(data)?.[1];
    if (title || exception) return [title, exception].filter((part): part is string => Boolean(part)).map(clean).join(" : ");
    return clean(data);
  }
  if (data && typeof data === "object" && !(data instanceof Blob)) {
    const detail = (data as { detail?: unknown }).detail;
    return typeof detail === "string" ? detail : JSON.stringify(data);
  }
  return "";
}

function technicalOf(error: AxiosError): string {
  const request = `${(error.config?.method ?? "get").toUpperCase()} ${error.config?.baseURL ?? ""}${error.config?.url ?? ""}`;
  const status = error.response ? `HTTP ${error.response.status}` : (error.code ?? error.message);
  const body = error.response ? bodyText(error.response.data) : "";
  return clip([request, status, body].filter(Boolean).join(" · "));
}

function messageForStatus(status: number): string {
  if (status === 401) return i18n.t("Authentification requise (401).");
  if (status === 403) return i18n.t("Accès refusé (403).");
  if (status === 404) return i18n.t("Adresse introuvable (404).");
  if (status === 413) return i18n.t("Requête trop volumineuse (413).");
  if (status === 429) return i18n.t("Trop de requêtes (429) : réessayez dans quelques instants.");
  if (status === 502 || status === 503 || status === 504) {
    return i18n.t("Le serveur ne répond pas ({{status}}) : vérifiez qu'il est démarré.", { status });
  }
  if (status >= 500) return i18n.t("Erreur interne du serveur ({{status}}).", { status });
  return i18n.t("Requête refusée par le serveur ({{status}}).", { status });
}

/** Every failed request becomes an ApiError, whatever its cause (HTTP error, network, timeout). */
export class ApiError extends Error {
  status: number;
  code: string;
  details: unknown;
  /** Original request, so that an interceptor can retry it (token refresh). */
  config?: InternalAxiosRequestConfig;
  /** What was called and what the server answered: shown next to unexpected errors. */
  technical?: string;

  constructor(
    message: string,
    status: number,
    code: string,
    details?: unknown,
    config?: InternalAxiosRequestConfig,
    technical?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.config = config;
    this.technical = technical;
  }

  /** Field-level messages of a validation error, e.g. { email: ["Ce champ est obligatoire."] }. */
  get fieldErrors(): Record<string, string[]> {
    return flattenDetails(this.details);
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof AxiosError) {
    const technical = technicalOf(error);
    const data = error.response?.data;
    const uniform = data && typeof data === "object" ? (data as Partial<ApiErrorBody>).error : undefined;

    // The usual answer of the API: { error: { code, message, status, details } }.
    if (error.response && uniform) {
      const { code, message, status, details } = uniform;
      // Validation error without field (a plain sentence from the API): show that sentence.
      const text =
        code === "validation_error" && Array.isArray(details)
          ? messages(details).map(translateApiMessage).join(" ") || translateApiMessage(message)
          : translateApiMessage(message);
      const finalStatus = status ?? error.response.status;
      const unexpected = finalStatus >= 500;
      if (import.meta.env.DEV && unexpected) console.error("[API]", technical, data);
      return new ApiError(text, finalStatus, code, details, error.config, unexpected ? technical : undefined);
    }

    if (error.response) {
      const { status } = error.response;
      if (import.meta.env.DEV) console.error("[API]", technical, data);

      // Plain DRF validation answer ({ field: ["message"] }): handled like a validation error.
      if (status === 400 && data && typeof data === "object" && !Array.isArray(data) && !("detail" in data)) {
        return new ApiError(i18n.t("Les données envoyées sont invalides."), 400, "validation_error", data, error.config, technical);
      }
      // DRF default answer ({ detail: "..." }).
      const detail = data && typeof data === "object" ? (data as { detail?: unknown }).detail : undefined;
      const message = typeof detail === "string" ? translateApiMessage(detail) : messageForStatus(status);
      return new ApiError(message, status, "http_error", undefined, error.config, technical);
    }

    if (error.code === "ECONNABORTED") {
      return new ApiError(i18n.t("Le serveur met trop de temps à répondre."), 0, "timeout", undefined, error.config, technical);
    }
    if (import.meta.env.DEV) console.error("[API]", technical);
    return new ApiError(i18n.t("Impossible de joindre le serveur."), 0, "network_error", undefined, error.config, technical);
  }

  return new ApiError(
    i18n.t("Une erreur inattendue est survenue."),
    0,
    "unknown_error",
    undefined,
    undefined,
    error instanceof Error ? error.message : undefined,
  );
}

export function getErrorMessage(error: unknown): string {
  return toApiError(error).message;
}