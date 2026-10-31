import { useApiQuery } from "@/lib/hooks/useApiQuery";
import { getEmployee, listEmployees } from "./services/employeeService";

/**
 * The employee record of the logged-in user, or null when the account is linked to none.
 * The API only returns the user's own record to an EMPLOYEE, so the first result is theirs.
 */
export function useMyEmployee() {
    return useApiQuery(["my-employee"], async (signal) => {
        const { results } = await listEmployees({ page: 1 }, signal);
        const first = results[0];
        return first ? await getEmployee(first.id, signal) : null;
    });
}