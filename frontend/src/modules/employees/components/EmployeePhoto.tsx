import { useEffect, useState } from "react";
import { cx } from "@/lib/cx";
import { fetchEmployeePhoto } from "../services/employeeService";

const SIZES = { sm: "size-10 text-sm", md: "size-16 text-xl", lg: "size-40 text-5xl" } as const;

/** Photo from the authenticated endpoint, or the initials when there is none. */
export function EmployeePhoto({
    id,
    hasPhoto,
    name,
    version,
    size = "md",
}: {
    id: number;
    hasPhoto: boolean;
    name: string;
    /** Changes when the photo changes (e.g. `updated_at`): triggers a reload. */
    version?: string;
    size?: keyof typeof SIZES;
}) {
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!hasPhoto) return;
        const controller = new AbortController();
        let objectUrl: string | null = null;
        fetchEmployeePhoto(id, controller.signal).then(
            (blob) => {
                objectUrl = URL.createObjectURL(blob);
                setUrl(objectUrl);
            },
            () => {
                // Photo unavailable: the initials stay.
            },
        );
        return () => {
            controller.abort();
            if (objectUrl) URL.revokeObjectURL(objectUrl); // free the memory
        };
    }, [id, hasPhoto, version]);

    const shown = hasPhoto ? url : null;
    const initials = name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("");

    return shown ? (
        <img src={shown} alt={`Photo de ${name}`} className={cx("shrink-0 border-2 border-ink object-cover", SIZES[size])} />
    ) : (
        <span
            role="img"
            aria-label={`Initiales de ${name}`}
            className={cx("flex shrink-0 items-center justify-center border-2 border-ink bg-ink font-display font-bold text-paper", SIZES[size])}
        >
            {initials}
        </span>
    );
}