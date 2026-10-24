import { useSession } from "@/modules/auth/sessionContext";
import { EmployeeDashboard } from "../components/EmployeeDashboard";
import { HrDashboard } from "../components/HrDashboard";

/** ADMIN and HR see the company dashboard; an employee sees a personal one. */
export function DashboardPage() {
    const { user } = useSession();
    return user.role === "EMPLOYEE" ? <EmployeeDashboard /> : <HrDashboard />;
}