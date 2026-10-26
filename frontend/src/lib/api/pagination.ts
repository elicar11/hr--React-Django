import { api } from "./client";
import type { Page } from "./types";

const MAX_PAGES = 50;

/** Follows the pagination to the end. Only for small reference lists (departments, positions...). */
export async function fetchAllPages<T>(
    path: string,
    params: Record<string, string | number | undefined> = {},
    signal?: AbortSignal,
): Promise<T[]> {
    const results: T[] = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
        const { data } = await api.get<Page<T>>(path, { params: { ...params, page }, signal });
        results.push(...data.results);
        if (!data.next) break;
    }
    return results;
}

/** The API paginates by 20 (PAGE_SIZE of the backend). */
export const DEFAULT_PAGE_SIZE = 20;

/** One page of a paginated list. */
export async function fetchPage<T>(
    path: string,
    params: Record<string, string | number | undefined> = {},
    signal?: AbortSignal,
): Promise<Page<T>> {
    const { data } = await api.get<Page<T>>(path, { params, signal });
    return data;
}