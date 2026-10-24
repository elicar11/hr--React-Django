import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { cx } from "@/lib/cx";

/** [1, "gap", 4, 5, 6, "gap", 20]: first, last and the neighbours of the current page. */
function pageWindow(current: number, total: number): (number | "gap")[] {
    const pages = [...new Set([1, total, current - 1, current, current + 1])]
        .filter((page) => page >= 1 && page <= total)
        .sort((a, b) => a - b);
    const result: (number | "gap")[] = [];
    let previous = 0;
    for (const page of pages) {
        if (previous && page - previous > 1) result.push("gap");
        result.push(page);
        previous = page;
    }
    return result;
}

export function Pagination({
    page,
    count,
    pageSize = DEFAULT_PAGE_SIZE,
    onPageChange,
    className,
}: {
    page: number;
    count: number;
    pageSize?: number;
    onPageChange: (page: number) => void;
    className?: string;
}) {
    if (count === 0) return null;
    const pageCount = Math.max(1, Math.ceil(count / pageSize));
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, count);

    return (
        <nav aria-label="Pagination" className={cx("mt-4 flex flex-wrap items-center justify-between gap-3", className)}>
            <p className="text-sm text-gray-dark">
                {from}–{to} sur {count} résultat{count > 1 ? "s" : ""}
            </p>
            <ul className="flex flex-wrap items-center gap-2">
                <li>
                    <Button
                        size="sm"
                        variant="secondary"
                        disabled={page <= 1}
                        onClick={() => onPageChange(page - 1)}
                        leftIcon={<ChevronLeft className="size-4" aria-hidden="true" />}
                    >
                        Précédent
                    </Button>
                </li>
                {pageWindow(page, pageCount).map((item, index) =>
                    item === "gap" ? (
                        <li key={`gap-${index}`} aria-hidden="true" className="px-1 font-bold">
                            …
                        </li>
                    ) : (
                        <li key={item}>
                            <button
                                type="button"
                                onClick={() => onPageChange(item)}
                                aria-label={`Page ${item}`}
                                aria-current={item === page ? "page" : undefined}
                                className={cx(
                                    "min-w-9 border-2 border-ink px-2 py-1 text-sm font-bold",
                                    item === page ? "bg-ink text-paper" : "bg-paper hover:bg-ink hover:text-paper",
                                )}
                            >
                                {item}
                            </button>
                        </li>
                    ),
                )}
                <li>
                    <Button size="sm" variant="secondary" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
                        Suivant
                        <ChevronRight className="size-4" aria-hidden="true" />
                    </Button>
                </li>
            </ul>
        </nav>
    );
}