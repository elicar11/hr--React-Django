import { RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";

export function FilterBar({
    children,
    onReset,
    canReset = false,
}: {
    children: ReactNode;
    onReset?: () => void;
    /** Show the reset button only when at least one filter is active. */
    canReset?: boolean;
}) {
    return (
        <div role="group" aria-label="Filtres" className="mb-4 flex flex-wrap items-end gap-3 border-2 border-ink bg-gray-light p-4">
            {children}
            {onReset && canReset && (
                <Button size="sm" variant="secondary" onClick={onReset} leftIcon={<RotateCcw className="size-4" aria-hidden="true" />}>
                    Réinitialiser
                </Button>
            )}
        </div>
    );
}