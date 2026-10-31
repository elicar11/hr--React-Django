import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { getPayrollSettings } from "./services/payrollService";

/** Payroll settings (ADMIN / HR only: employees cannot read them). */
export function usePayrollSettings() {
    return useApiQuery(["payroll-settings"], (signal) => getPayrollSettings(signal));
}