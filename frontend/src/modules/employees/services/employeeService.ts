import { api, type Page } from "@/lib/api";
import { toDownload, type DownloadedFile } from "@/lib/download";
import type {
    AssignInput,
    Assignment,
    Employee,
    EmployeeCreateInput,
    EmployeeHistoryEntry,
    EmployeeInput,
    EmployeeListItem,
    ImportOutcome,
    ImportPreview,
} from "../types";

export type ListQuery = Record<string, string | number | undefined>;

export async function listEmployees(params: ListQuery, signal?: AbortSignal): Promise<Page<EmployeeListItem>> {
    const { data } = await api.get<Page<EmployeeListItem>>("/employees/", { params, signal });
    return data;
}

export async function getEmployee(id: number, signal?: AbortSignal): Promise<Employee> {
    const { data } = await api.get<Employee>(`/employees/${id}/`, { signal });
    return data;
}

export async function createEmployee(input: EmployeeCreateInput): Promise<Employee> {
    const { data } = await api.post<Employee>("/employees/", input);
    return data;
}

export async function updateEmployee(id: number, input: Partial<EmployeeInput>): Promise<Employee> {
    const { data } = await api.patch<Employee>(`/employees/${id}/`, input);
    return data;
}

// --- Assignment and status -------------------------------------------------------------------------

export async function getAssignments(id: number, signal?: AbortSignal): Promise<Assignment[]> {
    const { data } = await api.get<Assignment[]>(`/employees/${id}/assignments/`, { signal });
    return data;
}

export async function assignEmployee(id: number, input: AssignInput): Promise<Employee> {
    const { data } = await api.post<Employee>(`/employees/${id}/assign/`, input);
    return data;
}

export async function suspendEmployee(id: number): Promise<Employee> {
    const { data } = await api.post<Employee>(`/employees/${id}/suspend/`);
    return data;
}

export async function reactivateEmployee(id: number): Promise<Employee> {
    const { data } = await api.post<Employee>(`/employees/${id}/reactivate/`);
    return data;
}

export async function terminateEmployee(id: number, departureDate: string): Promise<Employee> {
    const { data } = await api.post<Employee>(`/employees/${id}/terminate/`, { departure_date: departureDate });
    return data;
}

// --- Photo ----------------------------------------------------------------------------------------

/** The photo is served by an authenticated endpoint: fetch it as a Blob. */
export async function fetchEmployeePhoto(id: number, signal?: AbortSignal): Promise<Blob> {
    const { data } = await api.get<Blob>(`/employees/${id}/photo/`, { responseType: "blob", signal });
    return data;
}

export async function uploadEmployeePhoto(id: number, file: File): Promise<Employee> {
    const form = new FormData();
    form.append("photo", file);
    const { data } = await api.post<Employee>(`/employees/${id}/photo/`, form);
    return data;
}

export async function deleteEmployeePhoto(id: number): Promise<void> {
    await api.delete(`/employees/${id}/photo/`);
}

// --- History ---------------------------------------------------------------------------------------

export async function getEmployeeHistory(
    id: number,
    page: number,
    signal?: AbortSignal,
): Promise<Page<EmployeeHistoryEntry>> {
    const { data } = await api.get<Page<EmployeeHistoryEntry>>(`/employees/${id}/history/`, {
        params: { page },
        signal,
    });
    return data;
}

// --- CSV export / import (ADMIN / HR) -------------------------------------------------------------

export async function exportEmployees(params: ListQuery): Promise<DownloadedFile> {
    const response = await api.get<Blob>("/employees/export/", { params, responseType: "blob" });
    return toDownload(response, "employes.csv");
}

export async function downloadImportTemplate(): Promise<DownloadedFile> {
    const response = await api.get<Blob>("/employees/import-template/", { responseType: "blob" });
    return toDownload(response, "modele-import-employes.csv");
}

export async function importEmployees(file: File, dryRun: true): Promise<ImportPreview>;
export async function importEmployees(file: File, dryRun: false): Promise<ImportOutcome>;
export async function importEmployees(file: File, dryRun: boolean): Promise<ImportPreview | ImportOutcome> {
    const form = new FormData();
    form.append("file", file);
    form.append("dry_run", String(dryRun));
    const { data } = await api.post<ImportPreview | ImportOutcome>("/employees/import/", form);
    return data;
}