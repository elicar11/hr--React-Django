import { api } from "@/lib/api";

/** Currency configured for the payroll, used to pre-fill contracts. Empty if unavailable. */
export async function getPayrollCurrency(signal?: AbortSignal): Promise<string> {
    try {
        const { data } = await api.get<{ currency: string }>("/payroll-settings/", { signal });
        return data.currency;
    } catch {
        return ""; // a convenience only: the user simply types the currency
    }
}