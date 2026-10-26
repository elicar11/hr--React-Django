import type { OnChangeFn, SortingState } from "@tanstack/react-table";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { orderingToSorting, sortingToOrdering } from "@/lib/ordering";

type Changes = Record<string, string | number | undefined>;

/**
 * State of a list page, kept in the URL (shareable, back button friendly):
 * page, search (debounced), ordering and the filters named in `filterKeys`.
 * Other URL parameters (e.g. `view`) are left untouched.
 */
export function useListParams(filterKeys: readonly string[], searchDelay = 300) {
    const [searchParams, setSearchParams] = useSearchParams();

    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const search = searchParams.get("search") ?? "";
    const ordering = searchParams.get("ordering") ?? "";
    const filters: Record<string, string> = {};
    for (const key of filterKeys) filters[key] = searchParams.get(key) ?? "";

    const update = useCallback(
        (changes: Changes, resetPage = true) => {
            setSearchParams(
                (previous) => {
                    const next = new URLSearchParams(previous);
                    for (const [key, value] of Object.entries(changes)) {
                        if (value === undefined || value === "") next.delete(key);
                        else next.set(key, String(value));
                    }
                    if (resetPage && !("page" in changes)) next.delete("page");
                    return next;
                },
                { replace: true },
            );
        },
        [setSearchParams],
    );

    // The text being typed lives here; it reaches the URL (and the API) after a short pause.
    const [draft, setDraft] = useState<string | null>(null);
    useEffect(() => {
        if (draft === null) return;
        const timer = setTimeout(() => {
            update({ search: draft.trim() });
            setDraft(null);
        }, searchDelay);
        return () => clearTimeout(timer);
    }, [draft, searchDelay, update]);

    const sorting = orderingToSorting(ordering);
    const setSorting: OnChangeFn<SortingState> = (updater) => {
        const next = typeof updater === "function" ? updater(sorting) : updater;
        update({ ordering: sortingToOrdering(next) });
    };

    const hasActiveFilters = search !== "" || filterKeys.some((key) => filters[key] !== "");

    function reset() {
        const cleared: Changes = { search: undefined, ordering: undefined, page: undefined };
        for (const key of filterKeys) cleared[key] = undefined;
        update(cleared);
    }

    return {
        page,
        search,
        ordering,
        sorting,
        setSorting,
        filters,
        hasActiveFilters,
        /** Text of the search box: what is being typed, else what the URL holds. */
        searchText: draft ?? search,
        setSearchText: setDraft,
        setFilter: (key: string, value: string) => update({ [key]: value }),
        setPage: (value: number) => update({ page: value }, false),
        getParam: (name: string) => searchParams.get(name) ?? "",
        setParam: (name: string, value: string) => update({ [name]: value }, false),
        reset,
    };
}