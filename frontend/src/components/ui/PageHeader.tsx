import { ChevronRight } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Link } from "react-router";

export interface Breadcrumb {
    label: string;
    to?: string;
}

/** Page title (h1), optional breadcrumb and actions. Also sets the browser tab title. */
export function PageHeader({
    title,
    description,
    actions,
    breadcrumb,
}: {
    title: string;
    description?: string;
    actions?: ReactNode;
    breadcrumb?: Breadcrumb[];
}) {
    useEffect(() => {
        document.title = `${title} · HR`;
    }, [title]);

    return (
        <div className="mb-6 space-y-3">
            {breadcrumb && (
                <nav aria-label="Fil d'Ariane">
                    <ol className="flex flex-wrap items-center gap-1 text-sm">
                        {breadcrumb.map((item, index) => (
                            <li key={item.label} className="flex items-center gap-1">
                                {index > 0 && <ChevronRight className="size-4" aria-hidden="true" />}
                                {item.to ? (
                                    <Link to={item.to} className="font-bold underline underline-offset-4 hover:bg-ink hover:text-paper">
                                        {item.label}
                                    </Link>
                                ) : (
                                    <span aria-current="page">{item.label}</span>
                                )}
                            </li>
                        ))}
                    </ol>
                </nav>
            )}
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-4xl md:text-5xl">{title}</h1>
                    {description && <p className="mt-2 max-w-2xl text-gray-dark">{description}</p>}
                </div>
                {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
            </div>
        </div>
    );
}