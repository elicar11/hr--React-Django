import {
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    useReactTable,
    type ColumnDef,
    type OnChangeFn,
    type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";

export interface DataTableProps<T> {
    /** Accessible name of the table. */
    caption: string;
    /** Define columns as plain `ColumnDef<T>[]` objects. */
    columns: ColumnDef<T, unknown>[];
    data: T[];
    loading?: boolean;
    getRowId?: (row: T) => string;
    /** If provided, sorting is controlled (server-side: send `ordering` to the API). Otherwise it is local. */
    sorting?: SortingState;
    onSortingChange?: OnChangeFn<SortingState>;
    onRowClick?: (row: T) => void;
    emptyState?: ReactNode;
    /** Small screens (< md): rows are shown as cards. Without it, the table scrolls horizontally. */
    renderMobileCard?: (row: T) => ReactNode;
}

function ariaSort(state: false | "asc" | "desc") {
    if (state === "asc") return "ascending";
    if (state === "desc") return "descending";
    return "none";
}

function SortIcon({ state }: { state: false | "asc" | "desc" }) {
    if (state === "asc") return <ArrowUp className="size-4" aria-hidden="true" />;
    if (state === "desc") return <ArrowDown className="size-4" aria-hidden="true" />;
    return <ArrowUpDown className="size-4 opacity-60" aria-hidden="true" />;
}

export function DataTable<T>({
    caption,
    columns,
    data,
    loading = false,
    getRowId,
    sorting: controlledSorting,
    onSortingChange,
    onRowClick,
    emptyState,
    renderMobileCard,
}: DataTableProps<T>) {
    const [localSorting, setLocalSorting] = useState<SortingState>([]);
    const controlled = controlledSorting !== undefined;

    const table = useReactTable({
        data,
        columns,
        state: { sorting: controlled ? controlledSorting : localSorting },
        onSortingChange: controlled ? onSortingChange : setLocalSorting,
        manualSorting: controlled,
        enableSortingRemoval: true,
        getRowId,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: controlled ? undefined : getSortedRowModel(),
    });

    const columnCount = table.getAllLeafColumns().length;
    const rows = table.getRowModel().rows;

    if (!loading && rows.length === 0) {
        return <>{emptyState ?? <EmptyState title="Aucun résultat" description="Aucune donnée ne correspond à votre recherche." />}</>;
    }

    return (
        <>
            {renderMobileCard && (
                <ul className="space-y-3 md:hidden" aria-label={caption} aria-busy={loading || undefined}>
                    {loading
                        ? Array.from({ length: 3 }, (_, index) => (
                            <li key={index} className="border-2 border-ink bg-paper p-4">
                                <Skeleton className="h-5 w-2/3" />
                                <Skeleton className="mt-3 h-4 w-1/2" />
                            </li>
                        ))
                        : rows.map((row) => (
                            <li key={row.id} className="border-2 border-ink bg-paper p-4 shadow-hard-sm">
                                {renderMobileCard(row.original)}
                            </li>
                        ))}
                </ul>
            )}

            <div
                role="region"
                aria-label={caption}
                tabIndex={0}
                aria-busy={loading || undefined}
                className={cx("overflow-x-auto border-2 border-ink bg-paper shadow-hard", renderMobileCard && "hidden md:block")}
            >
                <table className="w-full border-collapse text-left text-sm">
                    <caption className="sr-only">{caption}</caption>
                    <thead className="bg-ink text-paper">
                        {table.getHeaderGroups().map((group) => (
                            <tr key={group.id}>
                                {group.headers.map((header) => {
                                    const sortable = header.column.getCanSort();
                                    const state = header.column.getIsSorted();
                                    return (
                                        <th
                                            key={header.id}
                                            scope="col"
                                            aria-sort={sortable ? ariaSort(state) : undefined}
                                            className="whitespace-nowrap px-4 py-3 font-bold uppercase tracking-wide"
                                        >
                                            {header.isPlaceholder ? null : sortable ? (
                                                <button
                                                    type="button"
                                                    onClick={header.column.getToggleSortingHandler()}
                                                    className="inline-flex items-center gap-2 font-bold uppercase tracking-wide focus-visible:outline-paper"
                                                >
                                                    {flexRender(header.column.columnDef.header, header.getContext())}
                                                    <SortIcon state={state} />
                                                </button>
                                            ) : (
                                                flexRender(header.column.columnDef.header, header.getContext())
                                            )}
                                        </th>
                                    );
                                })}
                            </tr>
                        ))}
                    </thead>
                    <tbody>
                        {loading
                            ? Array.from({ length: 5 }, (_, index) => (
                                <tr key={index} className="border-t-2 border-ink">
                                    {Array.from({ length: columnCount }, (_, cell) => (
                                        <td key={cell} className="px-4 py-3">
                                            <Skeleton className="h-4 w-full max-w-40" />
                                        </td>
                                    ))}
                                </tr>
                            ))
                            : rows.map((row) => (
                                <tr
                                    key={row.id}
                                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                                    onKeyDown={
                                        onRowClick
                                            ? (event) => {
                                                if (event.key === "Enter") onRowClick(row.original);
                                            }
                                            : undefined
                                    }
                                    tabIndex={onRowClick ? 0 : undefined}
                                    className={cx("border-t-2 border-ink", onRowClick && "cursor-pointer hover:bg-gray-light")}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <td key={cell.id} className="px-4 py-3 align-middle">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}