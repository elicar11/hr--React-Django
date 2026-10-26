import type { AxiosResponse } from "axios";

export interface DownloadedFile {
    blob: Blob;
    filename: string;
}

/** Reads the file name from Content-Disposition (falls back to `fallbackName`). */
export function toDownload(response: AxiosResponse<Blob>, fallbackName: string): DownloadedFile {
    const disposition = String(response.headers["content-disposition"] ?? "");
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    return { blob: response.data, filename: match?.[1] ? decodeURIComponent(match[1]) : fallbackName };
}

/** Triggers the browser download of a Blob. */
export function saveFile({ blob, filename }: DownloadedFile) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}