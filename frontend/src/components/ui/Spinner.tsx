import { cx } from "@/lib/cx";

const SIZES = { sm: "size-4", md: "size-6", lg: "size-10" } as const;

export function Spinner({
    size = "md",
    label = "Chargement…",
}: {
    size?: keyof typeof SIZES;
    label?: string;
}) {
    return (
        <span role="status" className="inline-flex items-center">
            <span
                aria-hidden="true"
                className={cx("inline-block animate-spin border-2 border-current border-t-transparent", SIZES[size])}
            />
            <span className="sr-only">{label}</span>
        </span>
    );
}