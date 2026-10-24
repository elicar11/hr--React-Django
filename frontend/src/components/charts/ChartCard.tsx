import { useId, useState, type ReactNode } from "react";
import { Button, Card, EmptyState } from "@/components/ui";
import { cx } from "@/lib/cx";

function DataRows({ columns, rows, hidden }: { columns: string[]; rows: ReactNode[][]; hidden: boolean }) {
    return (
        <table className={cx("w-full border-collapse text-left text-sm", hidden && "sr-only")}>
            <thead>
                <tr className="bg-ink text-paper">
                    {columns.map((column) => (
                        <th key={column} scope="col" className="px-3 py-2 font-bold uppercase tracking-wide">
                            {column}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.map((row, index) => (
                    <tr key={index} className="border-t-2 border-ink">
                        {row.map((cell, position) => (
                            <td key={position} className="px-3 py-2">
                                {cell}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

/**
 * Card holding a chart. The chart itself is hidden from assistive technologies:
 * the same figures are always available as a table (read by screen readers, and shown on demand).
 */
export function ChartCard({
    title,
    description,
    columns,
    rows,
    className,
    children,
}: {
    title: string;
    description?: string;
    columns: string[];
    rows: ReactNode[][];
    className?: string;
    children: ReactNode;
}) {
    const panelId = useId();
    const [showTable, setShowTable] = useState(false);

    return (
        <Card
            title={title}
            description={description}
            className={className}
            actions={
                rows.length > 0 ? (
                    <Button
                        size="sm"
                        variant="secondary"
                        aria-expanded={showTable}
                        aria-controls={panelId}
                        onClick={() => setShowTable((current) => !current)}
                    >
                        {showTable ? "Voir le graphique" : "Voir le tableau"}
                    </Button>
                ) : undefined
            }
        >
            <div id={panelId}>
                {rows.length === 0 ? (
                    <EmptyState title="Aucune donnée" description="Rien à afficher pour ces filtres." />
                ) : showTable ? (
                    <DataRows columns={columns} rows={rows} hidden={false} />
                ) : (
                    <>
                        {children}
                        <DataRows columns={columns} rows={rows} hidden />
                    </>
                )}
            </div>
        </Card>
    );
}