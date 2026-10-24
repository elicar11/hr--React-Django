import { MoreHorizontal } from "lucide-react";
import { Menu, type MenuItem } from "./Menu";

/** "..." menu at the end of a table row. Clicks do not trigger the row's own click. */
export function RowActions({ label, items }: { label: string; items: MenuItem[] }) {
    return (
        <div
            className="flex justify-end"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
        >
            <Menu
                label={label}
                items={items}
                align="end"
                trigger={<MoreHorizontal className="size-5" aria-hidden="true" />}
                triggerClassName="border-2 border-ink bg-paper p-1.5 hover:bg-ink hover:text-paper"
            />
        </div>
    );
}