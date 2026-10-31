import { api, type Page } from "@/lib/api";
import { toDownload, type DownloadedFile } from "@/lib/download";
import type {
    AttendanceCorrection,
    AttendanceRecord,
    AttendanceSummaryRow,
    AttendanceUpdateInput,
    AttendanceWriteInput,
    CorrectionRequestInput,
    TodayOverview,
} from "../types";

export type ListQuery = Record<string, string | number | undefined>;

// --- Self-service clock: the time is the server's, never sent by the client ------------------------

export async function checkIn(): Promise<AttendanceRecord> {
    const { data } = await api.post<AttendanceRecord>("/attendance/check-in/");
    return data;
}

export async function checkOut(): Promise<AttendanceRecord> {
    const { data } = await api.post<AttendanceRecord>("/attendance/check-out/");
    return data;
}

export async function getToday(signal?: AbortSignal): Promise<TodayOverview> {
    const { data } = await api.get<TodayOverview>("/attendance/today/", { signal });
    return data;
}

// --- Records ---------------------------------------------------------------------------------------------

export async function listAttendance(params: ListQuery, signal?: AbortSignal): Promise<Page<AttendanceRecord>> {
    const { data } = await api.get<Page<AttendanceRecord>>("/attendance/", { params, signal });
    return data;
}

export async function getAttendanceSummary(params: ListQuery, signal?: AbortSignal): Promise<Page<AttendanceSummaryRow>> {
    const { data } = await api.get<Page<AttendanceSummaryRow>>("/attendance/summary/", { params, signal });
    return data;
}

export async function createAttendanceRecord(input: AttendanceWriteInput): Promise<AttendanceRecord> {
    const { data } = await api.post<AttendanceRecord>("/attendance/", input);
    return data;
}

export async function updateAttendanceRecord(id: number, input: AttendanceUpdateInput): Promise<AttendanceRecord> {
    const { data } = await api.patch<AttendanceRecord>(`/attendance/${id}/`, input);
    return data;
}

/** Absences only: a presence must be corrected, not erased. */
export async function deleteAttendanceRecord(id: number): Promise<void> {
    await api.delete(`/attendance/${id}/`);
}

export async function exportAttendance(params: ListQuery): Promise<DownloadedFile> {
    const response = await api.get<Blob>("/attendance/export/", { params, responseType: "blob" });
    return toDownload(response, "presences.csv");
}

// --- Correction requests -----------------------------------------------------------------------------------

export async function listCorrections(params: ListQuery, signal?: AbortSignal): Promise<Page<AttendanceCorrection>> {
    const { data } = await api.get<Page<AttendanceCorrection>>("/attendance-corrections/", { params, signal });
    return data;
}

export async function createCorrection(input: CorrectionRequestInput): Promise<AttendanceCorrection> {
    const { data } = await api.post<AttendanceCorrection>("/attendance-corrections/", input);
    return data;
}

export async function approveCorrection(id: number, comment: string): Promise<AttendanceCorrection> {
    const { data } = await api.post<AttendanceCorrection>(`/attendance-corrections/${id}/approve/`, { comment });
    return data;
}

export async function rejectCorrection(id: number, comment: string): Promise<AttendanceCorrection> {
    const { data } = await api.post<AttendanceCorrection>(`/attendance-corrections/${id}/reject/`, { comment });
    return data;
}

export async function cancelCorrection(id: number): Promise<AttendanceCorrection> {
    const { data } = await api.post<AttendanceCorrection>(`/attendance-corrections/${id}/cancel/`);
    return data;
}