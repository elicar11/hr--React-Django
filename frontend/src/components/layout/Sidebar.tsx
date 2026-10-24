import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Link, NavLink } from "react-router";
import { cx } from "@/lib/cx";
import { useSession } from "@/modules/auth/sessionContext";
import { navigationFor } from "./navigation";

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
    const groups = navigationFor(user.role);

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

            <nav aria-label="Navigation principale" className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
                {groups.map((group, index) => (
                    <div key={group.label ?? index}>
                        {group.label &&
                            (collapsed ? (
                                <div className="mx-3 mb-2 border-t-2 border-gray-dark" aria-hidden="true" />
                            ) : (
                                <p className="px-3 pb-1 text-xs font-bold uppercase tracking-widest text-gray-mid">{group.label}</p>
                            ))}
                        <ul className="space-y-1">
                            {group.items.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <li key={item.to}>
                                        <NavLink
                                            to={item.to}
                                            end={item.end}
                                            onClick={onNavigate}
                                            title={collapsed ? item.label : undefined}
                                            className={({ isActive }) =>
                                                cx(
                                                    "flex items-center gap-3 border-2 px-3 py-2 font-bold focus-visible:outline-paper",
                                                    collapsed && "justify-center",
                                                    isActive ? "border-paper bg-paper text-ink" : "border-transparent hover:border-paper",
                                                )
                                            }
                                        >
                                            <Icon className="size-5 shrink-0" aria-hidden="true" />
                                            <span className={collapsed ? "sr-only" : undefined}>{item.label}</span>
                                        </NavLink>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
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