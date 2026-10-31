import { api, fetchAllPages, fetchPage, type Page } from "@/lib/api";
import { toDownload, type DownloadedFile } from "@/lib/download";
import type {
    CalculateResult,
    GenerateResult,
    PayElement,
    PayElementInput,
    PayItemType,
    PayItemTypeInput,
    PaymentMethod,
    PayrollPeriod,
    PayrollPeriodInput,
    PayrollSettings,
    PayrollSettingsInput,
    Payslip,
    PayslipHistoryEntry,
    PayslipLine,
    PayslipListItem,
    ValidateResult,
} from "../types";

export type ListQuery = Record<string, string | number | undefined>;

// --- Settings (ADMIN / HR) ------------------------------------------------------------------------------

export async function getPayrollSettings(signal?: AbortSignal): Promise<PayrollSettings> {
    const { data } = await api.get<PayrollSettings>("/payroll-settings/", { signal });
    return data;
}

export async function updatePayrollSettings(input: Partial<PayrollSettingsInput> & { is_demo?: boolean }): Promise<PayrollSettings> {
    const { data } = await api.patch<PayrollSettings>("/payroll-settings/", input);
    return data;
}

// --- Pay item types ------------------------------------------------------------------------------------

export function listPayItemTypes(params: ListQuery, signal?: AbortSignal): Promise<Page<PayItemType>> {
    return fetchPage<PayItemType>("/pay-item-types/", params, signal);
}

export function getAllPayItemTypes(signal?: AbortSignal, activeOnly = true): Promise<PayItemType[]> {
    return fetchAllPages<PayItemType>("/pay-item-types/", activeOnly ? { is_active: "true" } : {}, signal);
}

export async function createPayItemType(input: PayItemTypeInput): Promise<PayItemType> {
    const { data } = await api.post<PayItemType>("/pay-item-types/", input);
    return data;
}

export async function updatePayItemType(id: number, input: Partial<PayItemTypeInput>): Promise<PayItemType> {
    const { data } = await api.patch<PayItemType>(`/pay-item-types/${id}/`, input);
    return data;
}

export async function deletePayItemType(id: number): Promise<void> {
    await api.delete(`/pay-item-types/${id}/`);
}

// --- Employee pay elements (immutable: end it, then create a new one) ------------------------------------

export function listPayElements(params: ListQuery, signal?: AbortSignal): Promise<Page<PayElement>> {
    return fetchPage<PayElement>("/pay-elements/", params, signal);
}

export async function createPayElement(input: PayElementInput): Promise<PayElement> {
    const { data } = await api.post<PayElement>("/pay-elements/", input);
    return data;
}

export async function endPayElement(id: number, endDate: string): Promise<PayElement> {
    const { data } = await api.post<PayElement>(`/pay-elements/${id}/end/`, { end_date: endDate });
    return data;
}

// --- Periods ---------------------------------------------------------------------------------------------

export function listPeriods(params: ListQuery, signal?: AbortSignal): Promise<Page<PayrollPeriod>> {
    return fetchPage<PayrollPeriod>("/payroll-periods/", params, signal);
}

export function getAllPeriods(signal?: AbortSignal): Promise<PayrollPeriod[]> {
    return fetchAllPages<PayrollPeriod>("/payroll-periods/", { ordering: "-start_date" }, signal);
}

export async function getPeriod(id: number, signal?: AbortSignal): Promise<PayrollPeriod> {
    const { data } = await api.get<PayrollPeriod>(`/payroll-periods/${id}/`, { signal });
    return data;
}

export async function createPeriod(input: PayrollPeriodInput): Promise<PayrollPeriod> {
    const { data } = await api.post<PayrollPeriod>("/payroll-periods/", input);
    return data;
}

export async function updatePeriod(id: number, input: Partial<PayrollPeriodInput>): Promise<PayrollPeriod> {
    const { data } = await api.patch<PayrollPeriod>(`/payroll-periods/${id}/`, input);
    return data;
}

export async function deletePeriod(id: number): Promise<void> {
    await api.delete(`/payroll-periods/${id}/`);
}

export async function generatePayslips(id: number): Promise<GenerateResult> {
    const { data } = await api.post<GenerateResult>(`/payroll-periods/${id}/generate/`);
    return data;
}

export async function calculatePeriod(id: number): Promise<CalculateResult> {
    const { data } = await api.post<CalculateResult>(`/payroll-periods/${id}/calculate/`);
    return data;
}

export async function validatePeriod(id: number, comment: string): Promise<ValidateResult> {
    const { data } = await api.post<ValidateResult>(`/payroll-periods/${id}/validate/`, { comment });
    return data;
}

export async function closePeriod(id: number): Promise<PayrollPeriod> {
    const { data } = await api.post<PayrollPeriod>(`/payroll-periods/${id}/close/`);
    return data;
}

/** ADMIN only. */
export async function reopenPeriod(id: number): Promise<PayrollPeriod> {
    const { data } = await api.post<PayrollPeriod>(`/payroll-periods/${id}/reopen/`);
    return data;
}

export async function exportPeriod(id: number): Promise<DownloadedFile> {
    const response = await api.get<Blob>(`/payroll-periods/${id}/export/`, { responseType: "blob" });
    return toDownload(response, `paie-${id}.csv`);
}

// --- Payslips ----------------------------------------------------------------------------------------------

export function listPayslips(params: ListQuery, signal?: AbortSignal): Promise<Page<PayslipListItem>> {
    return fetchPage<PayslipListItem>("/payslips/", params, signal);
}

export async function getPayslip(id: number, signal?: AbortSignal): Promise<Payslip> {
    const { data } = await api.get<Payslip>(`/payslips/${id}/`, { signal });
    return data;
}

/** (Re)calculates a draft or calculated payslip; manual lines are kept. */
export async function calculatePayslip(id: number): Promise<Payslip> {
    const { data } = await api.post<Payslip>(`/payslips/${id}/calculate/`);
    return data;
}

export async function addManualLine(
    id: number,
    input: { item_type: number; amount: string; note: string },
): Promise<PayslipLine> {
    const { data } = await api.post<PayslipLine>(`/payslips/${id}/lines/`, input);
    return data;
}

export async function removeManualLine(id: number, lineId: number): Promise<void> {
    await api.delete(`/payslips/${id}/lines/${lineId}/`);
}

export async function validatePayslip(id: number, comment: string): Promise<Payslip> {
    const { data } = await api.post<Payslip>(`/payslips/${id}/validate/`, { comment });
    return data;
}

export async function payPayslip(
    id: number,
    input: { method: PaymentMethod; payment_date: string; reference: string },
): Promise<Payslip> {
    const { data } = await api.post<Payslip>(`/payslips/${id}/pay/`, input);
    return data;
}

export async function cancelPayslip(id: number, reason: string): Promise<Payslip> {
    const { data } = await api.post<Payslip>(`/payslips/${id}/cancel/`, { reason });
    return data;
}

export async function getPayslipHistory(id: number, signal?: AbortSignal): Promise<PayslipHistoryEntry[]> {
    const { data } = await api.get<PayslipHistoryEntry[]>(`/payslips/${id}/history/`, { signal });
    return data;
}