import { useCallback, useEffect, useRef, useState } from "react";
import { toApiError, type ApiError } from "@/lib/api";

export interface ApiQuery<T> {
    /** Last data received. Kept while a new request is running (no flicker). */
    data: T | null;
    /** Error of the last finished request. */
    error: ApiError | null;
    /** True while the request for the current `key` is running. */
    loading: boolean;
    reload: () => void;
}

/**
 * Loads data when `key` changes. The previous request is cancelled.
 * `key` must contain everything the request depends on (filters, page...).
 */
export function useApiQuery<T>(
    key: readonly unknown[],
    fetcher: (signal: AbortSignal) => Promise<T>,
): ApiQuery<T> {
    const [reloads, setReloads] = useState(0);
    const [result, setResult] = useState<{ requestKey: string; data: T | null; error: ApiError | null } | null>(null);

    // The fetcher is re-created on each render: always call the latest one.
    const fetcherRef = useRef(fetcher);
    useEffect(() => {
        fetcherRef.current = fetcher;
    });

    const requestKey = `${JSON.stringify(key)}#${reloads}`;

    useEffect(() => {
        const controller = new AbortController();
        fetcherRef.current(controller.signal).then(
            (data) => setResult({ requestKey, data, error: null }),
            (error: unknown) => {
                if (controller.signal.aborted) return; // superseded request: ignore
                setResult((previous) => ({ requestKey, data: previous?.data ?? null, error: toApiError(error) }));
            },
        );
        return () => controller.abort();
    }, [requestKey]);

    const loading = result?.requestKey !== requestKey;
    const reload = useCallback(() => setReloads((count) => count + 1), []);

    return { data: result?.data ?? null, error: loading ? null : (result?.error ?? null), loading, reload };
}