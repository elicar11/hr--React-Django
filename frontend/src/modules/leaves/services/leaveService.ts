import { api, fetchAllPages, fetchPage, type Page } from "@/lib/api";
import { toDownload, type DownloadedFile } from "@/lib/download";
import type {
    LeaveBalance,
    LeaveBalanceCreateInput,
    LeaveCalendar,
    LeaveDocument,
    LeaveHistoryEntry,
    LeaveRequest,
    LeaveRequestInput,
    LeaveType,
    LeaveTypeInput,
} from "../types";

export type ListQuery = Record<string, string | number | undefined>;

// --- Leave types ---------------------------------------------------------------------------------------

export function listLeaveTypes(params: ListQuery, signal?: AbortSignal): Promise<Page<LeaveType>> {
    return fetchPage<LeaveType>("/leave-types/", params, signal);
}

/** Every type (all pages): for select boxes. Readable by any user. */
export function getAllLeaveTypes(signal?: AbortSignal, activeOnly = true): Promise<LeaveType[]> {
    return fetchAllPages<LeaveType>("/leave-types/", activeOnly ? { is_active: "true" } : {}, signal);
}

export async function createLeaveType(input: LeaveTypeInput): Promise<LeaveType> {
    const { data } = await api.post<LeaveType>("/leave-types/", input);
    return data;
}

export async function updateLeaveType(id: number, input: Partial<LeaveTypeInput>): Promise<LeaveType> {
    const { data } = await api.patch<LeaveType>(`/leave-types/${id}/`, input);
    return data;
}

export async function deleteLeaveType(id: number): Promise<void> {
    await api.delete(`/leave-types/${id}/`);
}

// --- Balances ------------------------------------------------------------------------------------------

export function listBalances(params: ListQuery, signal?: AbortSignal): Promise<Page<LeaveBalance>> {
    return fetchPage<LeaveBalance>("/leave-balances/", params, signal);
}

export async function createBalance(input: LeaveBalanceCreateInput): Promise<LeaveBalance> {
    const { data } = await api.post<LeaveBalance>("/leave-balances/", input);
    return data;
}

/** The API refuses an allocation lower than the days already used. */
export async function updateBalance(id: number, allocated: string): Promise<LeaveBalance> {
    const { data } = await api.patch<LeaveBalance>(`/leave-balances/${id}/`, { allocated });
    return data;
}

export async function initializeBalances(year: number): Promise<{ year: number; created: number }> {
    const { data } = await api.post<{ year: number; created: number }>("/leave-balances/initialize/", { year });
    return data;
}

// --- Requests ------------------------------------------------------------------------------------------

export function listLeaveRequests(params: ListQuery, signal?: AbortSignal): Promise<Page<LeaveRequest>> {
    return fetchPage<LeaveRequest>("/leave-requests/", params, signal);
}

export async function getLeaveRequest(id: number, signal?: AbortSignal): Promise<LeaveRequest> {
    const { data } = await api.get<LeaveRequest>(`/leave-requests/${id}/`, { signal });
    return data;
}

/** The number of days is computed by the server (employee's schedule, holidays excluded). */
export async function createLeaveRequest(input: LeaveRequestInput): Promise<LeaveRequest> {
    const { data } = await api.post<LeaveRequest>("/leave-requests/", input);
    return data;
}

/** Pending requests only. */
export async function updateLeaveRequest(id: number, input: Partial<Omit<LeaveRequestInput, "employee">>): Promise<LeaveRequest> {
    const { data } = await api.patch<LeaveRequest>(`/leave-requests/${id}/`, input);
    return data;
}

export async function approveLeave(id: number, comment: string): Promise<LeaveRequest> {
    const { data } = await api.post<LeaveRequest>(`/leave-requests/${id}/approve/`, { comment });
    return data;
}

export async function rejectLeave(id: number, comment: string): Promise<LeaveRequest> {
    const { data } = await api.post<LeaveRequest>(`/leave-requests/${id}/reject/`, { comment });
    return data;
}

export async function cancelLeave(id: number, comment: string): Promise<LeaveRequest> {
    const { data } = await api.post<LeaveRequest>(`/leave-requests/${id}/cancel/`, { comment });
    return data;
}

export async function getLeaveHistory(id: number, signal?: AbortSignal): Promise<LeaveHistoryEntry[]> {
    const { data } = await api.get<LeaveHistoryEntry[]>(`/leave-requests/${id}/history/`, { signal });
    return data;
}

/** Pending and approved leaves overlapping the period (max 366 days), with the holidays. */
export async function getLeaveCalendar(params: ListQuery, signal?: AbortSignal): Promise<LeaveCalendar> {
    const { data } = await api.get<LeaveCalendar>("/leave-requests/calendar/", { params, signal });
    return data;
}

// --- Supporting documents --------------------------------------------------------------------------------

export async function listLeaveDocuments(id: number, signal?: AbortSignal): Promise<LeaveDocument[]> {
    const { data } = await api.get<LeaveDocument[]>(`/leave-requests/${id}/documents/`, { signal });
    return data;
}

export async function uploadLeaveDocument(id: number, title: string, file: File): Promise<LeaveDocument> {
    const form = new FormData();
    form.append("title", title);
    form.append("file", file);
    const { data } = await api.post<LeaveDocument>(`/leave-requests/${id}/documents/`, form);
    return data;
}

/** Served by an authenticated endpoint: fetched as a Blob. */
export async function downloadLeaveDocument(leaveId: number, documentId: number): Promise<DownloadedFile> {
    const response = await api.get<Blob>(`/leave-requests/${leaveId}/documents/${documentId}/`, { responseType: "blob" });
    return toDownload(response, `justificatif-${documentId}`);
}

export async function deleteLeaveDocument(leaveId: number, documentId: number): Promise<void> {
    await api.delete(`/leave-requests/${leaveId}/documents/${documentId}/`);
}