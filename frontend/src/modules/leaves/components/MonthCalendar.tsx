import { Link } from "react-router";
import { cx } from "@/lib/cx";
import { monthGrid } from "@/lib/calendar";
import type { Holiday } from "@/modules/attendance/types";
import type { LeaveRequest } from "../types";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MAX_VISIBLE = 3;

/**
 * Monthly grid: approved leaves are solid, pending ones dashed (shape, not color).
 * Each chip links to the request; the agenda below the grid lists everything.
 */
export function MonthCalendar({
    month,
    leaves,
    holidays,
}: {
    month: string;
    leaves: LeaveRequest[];
    holidays: Holiday[];
}) {
    const weeks = monthGrid(month);
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const holidayByDate = new Map(holidays.map((holiday) => [holiday.date, holiday.name]));

    return (
        <div role="grid" aria-label={`Calendrier des congés, ${month}`} className="border-2 border-ink bg-paper shadow-hard">
            <div role="row" className="grid grid-cols-7 bg-ink text-paper">
                {WEEKDAYS.map((day) => (
                    <div key={day} role="columnheader" className="px-2 py-2 text-center text-xs font-bold uppercase tracking-wide">
                        {day}
                    </div>
                ))}
            </div>
            {weeks.map((week) => (
                <div role="row" key={week[0]} className="grid grid-cols-7">
                    {week.map((iso) => {
                        const inMonth = iso.startsWith(month);
                        const onLeave = leaves.filter((leave) => leave.start_date <= iso && iso <= leave.end_date);
                        const holiday = holidayByDate.get(iso);
                        return (
                            <div
                                role="gridcell"
                                key={iso}
                                className={cx(
                                    "min-h-28 space-y-1 border-l-2 border-t-2 border-ink p-1.5 first:border-l-0",
                                    !inMonth && "bg-gray-light text-gray-dark",
                                )}
                            >
                                <p className={cx("text-sm font-bold", iso === todayIso && "inline-block bg-ink px-1.5 text-paper")}>
                                    {Number(iso.slice(8))}
                                </p>
                                {holiday && <p className="truncate border-2 border-ink px-1 text-xs font-bold" title={holiday}>Férié : {holiday}</p>}
                                {onLeave.slice(0, MAX_VISIBLE).map((leave) => (
                                    <Link
                                        key={leave.id}
                                        to={`/leaves/${leave.id}`}
                                        title={`${leave.employee_name} · ${leave.leave_type_name}${leave.status === "PENDING" ? " (en attente)" : ""}`}
                                        className={cx(
                                            "block truncate border-2 border-ink px-1 text-xs font-bold",
                                            leave.status === "APPROVED" ? "bg-ink text-paper" : "border-dashed bg-paper",
                                        )}
                                    >
                                        {leave.employee_name}
                                    </Link>
                                ))}
                                {onLeave.length > MAX_VISIBLE && (
                                    <p className="text-xs font-bold">+{onLeave.length - MAX_VISIBLE} autre(s)</p>
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}