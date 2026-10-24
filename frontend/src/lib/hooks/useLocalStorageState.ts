import { useCallback, useState } from "react";

/** UI preferences only (e.g. collapsed sidebar). Never store tokens or personal data here. */
export function useLocalStorageState<T>(key: string, initial: T) {
    const [value, setValue] = useState<T>(() => {
        try {
            const raw = window.localStorage.getItem(key);
            return raw === null ? initial : (JSON.parse(raw) as T);
        } catch {
            return initial;
        }
    });

    const update = useCallback(
        (next: T) => {
            setValue(next);
            try {
                window.localStorage.setItem(key, JSON.stringify(next));
            } catch {
                // Storage unavailable: the preference only lives in memory.
            }
        },
        [key],
    );

    return [value, update] as const;
}