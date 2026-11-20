import { formatDecimal } from "@/lib/format";
import { useTranslation } from "react-i18next";
import type { LeaveBalance } from "../types";

/** Progress bar of the used days. Display only: the figures come from the API. */
export function BalanceMeter({ balance }: { balance: LeaveBalance }) {
    const { t } = useTranslation();
    const allocated = Number(balance.allocated);
    const percent = allocated > 0 ? Math.min(100, (Number(balance.used) / allocated) * 100) : 0;
    return (
        <div
            role="progressbar"
            aria-label={t("{{type}} : {{used}} jours utilisés sur {{allocated}}", { type: balance.leave_type_name, used: formatDecimal(balance.used), allocated: formatDecimal(balance.allocated) })}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(percent)}
            className="h-3 border-2 border-ink bg-paper"
        >
            <div className="h-full bg-ink" style={{ width: `${percent}%` }} />
        </div>
    );
}
