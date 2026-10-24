import { Search, X } from "lucide-react";
import { useId } from "react";
import { cx } from "@/lib/cx";
import { controlClass } from "./fieldStyles";

export function SearchInput({
    value,
    onChange,
    label = "Rechercher",
    placeholder = "Rechercher…",
    className,
}: {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    placeholder?: string;
    className?: string;
}) {
    const id = useId();
    return (
        <div role="search" className={cx("relative", className)}>
            <label htmlFor={id} className="sr-only">
                {label}
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2" aria-hidden="true" />
            <input
                id={id}
                type="search"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className={cx(controlClass(), "pl-10 pr-10 [&::-webkit-search-cancel-button]:appearance-none")}
            />
            {value && (
                <button
                    type="button"
                    aria-label="Effacer la recherche"
                    onClick={() => onChange("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-ink hover:text-paper"
                >
                    <X className="size-4" aria-hidden="true" />
                </button>
            )}
        </div>
    );
}