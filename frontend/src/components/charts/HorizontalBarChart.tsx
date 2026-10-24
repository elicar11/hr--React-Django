import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_LINE, AXIS_TICK, FONT_FAMILY, GRAY_LIGHT, INK, TOOLTIP_STYLE, truncate } from "./chartTheme";

export interface BarDatum {
    label: string;
    value: number;
}

/** Black bars with the value written at the end: readable without any color. */
export function HorizontalBarChart({ data, valueLabel = "Employés" }: { data: BarDatum[]; valueLabel?: string }) {
    const height = Math.max(180, data.length * 38 + 32);
    return (
        <div style={{ height }} aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, left: 0, bottom: 4 }}>
                    <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
                    <YAxis
                        type="category"
                        dataKey="label"
                        width={150}
                        tick={AXIS_TICK}
                        axisLine={AXIS_LINE}
                        tickLine={false}
                        tickFormatter={(value: string) => truncate(value)}
                    />
                    <Tooltip cursor={{ fill: GRAY_LIGHT }} contentStyle={TOOLTIP_STYLE} formatter={(value) => [value, valueLabel]} />
                    <Bar dataKey="value" fill={INK} stroke={INK} strokeWidth={2} isAnimationActive={false}>
                        <LabelList
                            dataKey="value"
                            position="right"
                            style={{ fill: INK, fontWeight: 700, fontSize: 12, fontFamily: FONT_FAMILY }}
                        />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}