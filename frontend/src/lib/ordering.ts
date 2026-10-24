import type { SortingState } from "@tanstack/react-table";

/**
 * DRF `ordering` parameter built from a table sorting state: "last_name" or "-last_name".
 * `fields` maps column ids to API field names when they differ.
 */
export function sortingToOrdering(
    sorting: SortingState,
    fields: Record<string, string> = {},
): string | undefined {
    const [first] = sorting;
    if (!first) return undefined;
    const field = fields[first.id] ?? first.id;
    return first.desc ? `-${field}` : field;
}