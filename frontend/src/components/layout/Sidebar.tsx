import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Fragment, useId, useMemo, useState } from "react";
import { Link, useLocation } from "react-router";
import { cx } from "@/lib/cx";
import { useSession } from "@/modules/auth/sessionContext";
import { isItemActive, isSection, navigationFor, type NavItem, type NavSection } from "./navigation";

function ItemLink({
    item,
    active,
    collapsed,
    onNavigate,
}: {
    item: NavItem;
    active: boolean;
    collapsed: boolean;
    onNavigate?: () => void;
}) {
    const Icon = item.icon;
    return (
        <Link
            to={item.to}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={collapsed ? item.label : undefined}
            className={cx(
                "flex items-center gap-3 border-2 px-3 py-2 font-bold focus-visible:outline-paper",
                collapsed && "justify-center",
                active ? "border-paper bg-paper text-ink" : "border-transparent hover:border-paper",
            )}
        >
            <Icon className="size-5 shrink-0" aria-hidden="true" />
            <span className={collapsed ? "sr-only" : undefined}>{item.label}</span>
        </Link>
    );
}

function Section({
    section,
    open,
    onToggle,
    pathname,
    onNavigate,
}: {
    section: NavSection;
    open: boolean;
    onToggle: () => void;
    pathname: string;
    onNavigate?: () => void;
}) {
    const panelId = useId();
    const Icon = section.icon;
    const containsActive = section.items.some((item) => isItemActive(item, pathname));
    return (
        <li>
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                aria-controls={panelId}
                className={cx(
                    "flex w-full items-center gap-3 border-2 px-3 py-2 text-left font-bold focus-visible:outline-paper",
                    containsActive && !open ? "border-paper" : "border-transparent hover:border-paper",
                )}
            >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                <span className="flex-1">{section.label}</span>
                <ChevronDown className={cx("size-4 shrink-0 transition-transform", open && "rotate-180")} aria-hidden="true" />
            </button>
            <ul id={panelId} hidden={!open} className="ml-5 mt-1 space-y-1 border-l-2 border-gray-dark pl-2">
                {section.items.map((item) => (
                    <li key={item.to}>
                        <ItemLink item={item} active={isItemActive(item, pathname)} collapsed={false} onNavigate={onNavigate} />
                    </li>
                ))}
            </ul>
        </li>
    );
}

export function Sidebar({
    collapsed = false,
    onToggleCollapse,
    onNavigate,
}: {
    collapsed?: boolean;
    /** Provided on desktop only. */
    onToggleCollapse?: () => void;
    /** Closes the mobile drawer after a navigation. */
    onNavigate?: () => void;
}) {
    const { user } = useSession();
    const { pathname } = useLocation();
    const entries = useMemo(() => navigationFor(user.role), [user.role]);
    const sections = entries.filter(isSection);

    const activeLabel = sections.find((section) => section.items.some((item) => isItemActive(item, pathname)))?.label ?? null;
    const [openLabel, setOpenLabel] = useState<string | null>(activeLabel ?? sections[0]?.label ?? null);

    // Opens the section of the page the user just reached (state adjusted during render, no effect needed).
    const [syncedPath, setSyncedPath] = useState(pathname);
    if (syncedPath !== pathname) {
        setSyncedPath(pathname);
        if (activeLabel) setOpenLabel(activeLabel);
    }

    return (
        <div className="flex h-full flex-col bg-ink text-paper">
            <div className="flex h-16 shrink-0 items-center border-b-2 border-paper px-3">
                <Link
                    to="/"
                    onClick={onNavigate}
                    aria-label="HR, retour au tableau de bord"
                    className="flex items-center gap-3 focus-visible:outline-paper"
                >
                    <span className="flex size-10 shrink-0 items-center justify-center border-2 border-paper bg-paper font-display text-xl font-bold text-ink">
                        HR
                    </span>
                    {!collapsed && <span className="font-display text-lg font-bold leading-tight">Ressources humaines</span>}
                </Link>
            </div>

            {/* Scrolling is only a safety net for very short screens: its bar stays hidden. */}
            <nav
                aria-label="Navigation principale"
                className="min-h-0 flex-1 overflow-y-auto px-2 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
                <ul className="space-y-1">
                    {collapsed
                        ? entries.map((entry, index) =>
                            isSection(entry) ? (
                                <Fragment key={entry.label}>
                                    <li aria-hidden="true" className="mx-3 border-t-2 border-gray-dark" />
                                    {entry.items.map((item) => (
                                        <li key={item.to}>
                                            <ItemLink item={item} active={isItemActive(item, pathname)} collapsed onNavigate={onNavigate} />
                                        </li>
                                    ))}
                                    {index < entries.length - 1 && <li aria-hidden="true" className="mx-3 border-t-2 border-gray-dark" />}
                                </Fragment>
                            ) : (
                                <li key={entry.to}>
                                    <ItemLink item={entry} active={isItemActive(entry, pathname)} collapsed onNavigate={onNavigate} />
                                </li>
                            ),
                        )
                        : entries.map((entry) =>
                            isSection(entry) ? (
                                <Section
                                    key={entry.label}
                                    section={entry}
                                    open={openLabel === entry.label}
                                    onToggle={() => setOpenLabel((current) => (current === entry.label ? null : entry.label))}
                                    pathname={pathname}
                                    onNavigate={onNavigate}
                                />
                            ) : (
                                <li key={entry.to}>
                                    <ItemLink item={entry} active={isItemActive(entry, pathname)} collapsed={false} onNavigate={onNavigate} />
                                </li>
                            ),
                        )}
                </ul>
            </nav>

            {onToggleCollapse && (
                <div className="shrink-0 border-t-2 border-paper p-2">
                    <button
                        type="button"
                        onClick={onToggleCollapse}
                        aria-expanded={!collapsed}
                        aria-label={collapsed ? "Déployer le menu" : "Réduire le menu"}
                        className={cx(
                            "flex w-full items-center gap-3 border-2 border-transparent px-3 py-2 font-bold hover:border-paper focus-visible:outline-paper",
                            collapsed && "justify-center",
                        )}
                    >
                        {collapsed ? (
                            <PanelLeftOpen className="size-5" aria-hidden="true" />
                        ) : (
                            <PanelLeftClose className="size-5" aria-hidden="true" />
                        )}
                        {!collapsed && <span>Réduire</span>}
                    </button>
                </div>
            )}
        </div>
    );
}