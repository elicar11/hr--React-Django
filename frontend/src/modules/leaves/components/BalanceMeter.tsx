import { formatDecimal } from "@/lib/format";
import type { LeaveBalance } from "../types";

/** Progress bar of the used days. Display only: the figures come from the API. */
export function BalanceMeter({ balance }: { balance: LeaveBalance }) {
    const allocated = Number(balance.allocated);
    const percent = allocated > 0 ? Math.min(100, (Number(balance.used) / allocated) * 100) : 0;
    return (
        <div
            role="progressbar"
            aria-label={`${balance.leave_type_name} : ${formatDecimal(balance.used)} jours utilisés sur ${formatDecimal(balance.allocated)}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(percent)}
            className="h-3 border-2 border-ink bg-paper"
        >
            <div className="h-full bg-ink" style={{ width: `${percent}%` }} />
        </div>
    );
}