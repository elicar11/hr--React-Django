/** Literal values: SVG attributes do not always resolve CSS variables. Same as the design tokens. */
export const INK = "#000000";
export const PAPER = "#ffffff";
export const GRAY_LIGHT = "#f2f2f2";
export const GRAY_MID = "#d9d9d9";
export const FONT_FAMILY = '"Inter Variable", ui-sans-serif, system-ui, sans-serif';

export const AXIS_TICK = { fill: INK, fontSize: 12, fontFamily: FONT_FAMILY };
export const AXIS_LINE = { stroke: INK, strokeWidth: 2 };

export const TOOLTIP_STYLE = {
    border: `2px solid ${INK}`,
    borderRadius: 0,
    boxShadow: `4px 4px 0 ${INK}`,
    fontFamily: FONT_FAMILY,
    fontSize: 13,
};

export function truncate(value: string, max = 22): string {
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}