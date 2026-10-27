import { api, fetchAllPages, type Page } from "@/lib/api";
import { toDownload, type DownloadedFile } from "@/lib/download";
import type {
    Contract,
    ContractDocument,
    ContractHistoryEntry,
    ContractInput,
    ContractListItem,
    ContractType,
    ContractTypeInput,
    RenewInput,
} from "../types";

export type ListQuery = Record<string, string | number | undefined>;

// --- Contracts ---------------------------------------------------------------------------------------

export async function listContracts(params: ListQuery, signal?: AbortSignal): Promise<Page<ContractListItem>> {
    const { data } = await api.get<Page<ContractListItem>>("/contracts/", { params, signal });
    return data;
}

/** Running contracts ending within `days` days (overdue ones included). ADMIN / HR. */
export async function listExpiringContracts(params: ListQuery, signal?: AbortSignal): Promise<Page<ContractListItem>> {
    const { data } = await api.get<Page<ContractListItem>>("/contracts/expiring/", { params, signal });
    return data;
}

export async function getContract(id: number, signal?: AbortSignal): Promise<Contract> {
    const { data } = await api.get<Contract>(`/contracts/${id}/`, { signal });
    return data;
}

export async function createContract(input: ContractInput): Promise<Contract> {
    const { data } = await api.post<Contract>("/contracts/", input);
    return data;
}

/** Drafts only: the API refuses to edit a signed contract. */
export async function updateContract(id: number, input: Partial<ContractInput>): Promise<Contract> {
    const { data } = await api.patch<Contract>(`/contracts/${id}/`, input);
    return data;
}

export async function deleteContract(id: number): Promise<void> {
    await api.delete(`/contracts/${id}/`);
}

export async function activateContract(id: number, signedDate: string): Promise<Contract> {
    const { data } = await api.post<Contract>(`/contracts/${id}/activate/`, { signed_date: signedDate });
    return data;
}

/** Creates the draft successor; the renewed contract is left untouched. */
export async function renewContract(id: number, input: RenewInput): Promise<Contract> {
    const { data } = await api.post<Contract>(`/contracts/${id}/renew/`, input);
    return data;
}

export async function terminateContract(id: number, endDate: string): Promise<Contract> {
    const { data } = await api.post<Contract>(`/contracts/${id}/terminate/`, { end_date: endDate });
    return data;
}

export async function getContractHistory(
    id: number,
    page: number,
    signal?: AbortSignal,
): Promise<Page<ContractHistoryEntry>> {
    const { data } = await api.get<Page<ContractHistoryEntry>>(`/contracts/${id}/history/`, { params: { page }, signal });
    return data;
}

// --- Documents -----------------------------------------------------------------------------------------

export async function listContractDocuments(id: number, signal?: AbortSignal): Promise<ContractDocument[]> {
    const { data } = await api.get<ContractDocument[]>(`/contracts/${id}/documents/`, { signal });
    return data;
}

export async function uploadContractDocument(id: number, title: string, file: File): Promise<ContractDocument> {
    const form = new FormData();
    form.append("title", title);
    form.append("file", file);
    const { data } = await api.post<ContractDocument>(`/contracts/${id}/documents/`, form);
    return data;
}

/** Served by an authenticated endpoint: fetched as a Blob. */
export async function downloadContractDocument(contractId: number, documentId: number): Promise<DownloadedFile> {
    const response = await api.get<Blob>(`/contracts/${contractId}/documents/${documentId}/`, { responseType: "blob" });
    return toDownload(response, `document-${documentId}.pdf`);
}

export async function deleteContractDocument(contractId: number, documentId: number): Promise<void> {
    await api.delete(`/contracts/${contractId}/documents/${documentId}/`);
}

// --- Contract types --------------------------------------------------------------------------------------

export async function listContractTypes(params: ListQuery, signal?: AbortSignal): Promise<Page<ContractType>> {
    const { data } = await api.get<Page<ContractType>>("/contract-types/", { params, signal });
    return data;
}

/** Every type (all pages): for select boxes. */
export function getAllContractTypes(signal?: AbortSignal, activeOnly = true): Promise<ContractType[]> {
    return fetchAllPages<ContractType>("/contract-types/", activeOnly ? { is_active: "true" } : {}, signal);
}

export async function createContractType(input: ContractTypeInput): Promise<ContractType> {
    const { data } = await api.post<ContractType>("/contract-types/", input);
    return data;
}

export async function updateContractType(id: number, input: Partial<ContractTypeInput>): Promise<ContractType> {
    const { data } = await api.patch<ContractType>(`/contract-types/${id}/`, input);
    return data;
}

export async function deleteContractType(id: number): Promise<void> {
    await api.delete(`/contract-types/${id}/`);
}