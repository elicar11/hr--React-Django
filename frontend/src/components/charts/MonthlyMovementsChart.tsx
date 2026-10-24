import { useId } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMonth } from "@/lib/format";
import type { MonthlyMovement } from "@/modules/dashboard/types";
import { AXIS_LINE, AXIS_TICK, GRAY_LIGHT, GRAY_MID, INK, PAPER, TOOLTIP_STYLE } from "./chartTheme";

function HatchDefs({ id }: { id: string }) {
    return (
        <pattern id={id} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <rect width="6" height="6" fill={PAPER} />
            <line x1="0" y1="0" x2="0" y2="6" stroke={INK} strokeWidth="2" />
        </pattern>
    );
}

function Swatch({ hatched }: { hatched: boolean }) {
    const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
    return (
        <svg width="18" height="18" aria-hidden="true">
            <defs>
                <HatchDefs id={id} />
            </defs>
            <rect x="1" y="1" width="16" height="16" fill={hatched ? `url(#${id})` : INK} stroke={INK} strokeWidth="2" />
        </svg>
    );
}

/** Hires = solid bars, departures = hatched bars: distinguishable without color. */
export function MonthlyMovementsChart({ data }: { data: MonthlyMovement[] }) {
    const patternId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
    const rows = data.map((item) => ({
        month: formatMonth(item.month),
        hires: item.hires,
        departures: item.departures,
    }));

    return (
        <div>
            <div className="mb-3 flex flex-wrap gap-5 text-sm font-bold" aria-hidden="true">
                <span className="flex items-center gap-2">
                    <Swatch hatched={false} /> Recrutements
                </span>
                <span className="flex items-center gap-2">
                    <Swatch hatched /> Départs
                </span>
            </div>
            <div className="h-72" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rows} margin={{ top: 16, right: 8, left: 0, bottom: 0 }} barGap={4}>
                        <defs>
                            <HatchDefs id={patternId} />
                        </defs>
                        <CartesianGrid stroke={GRAY_MID} vertical={false} />
                        <XAxis dataKey="month" tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
                        <YAxis allowDecimals={false} width={32} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
                        <Tooltip cursor={{ fill: GRAY_LIGHT }} contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey="hires" name="Recrutements" fill={INK} stroke={INK} strokeWidth={2} isAnimationActive={false} />
                        <Bar
                            dataKey="departures"
                            name="Départs"
                            fill={`url(#${patternId})`}
                            stroke={INK}
                            strokeWidth={2}
                            isAnimationActive={false}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}