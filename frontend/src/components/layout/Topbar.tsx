import { LogOut, Menu as MenuIcon, UserCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Menu, type MenuItem } from "@/components/ui/Menu";
import { SearchInput } from "@/components/ui/SearchInput";
import { notify } from "@/lib/notify";
import { useSession } from "@/modules/auth/sessionContext";
import { ROLE_LABELS, type Role } from "@/modules/auth/types";
import { AlertsMenu } from "./AlertsMenu";
import { useAlerts } from "./useAlerts";

function ProfileMenu() {
    const { user, setDemoRole } = useSession();
    const initials = `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase();

    const items: MenuItem[] = [
        { label: "Mon profil", icon: UserCircle, to: "/profile" },
        {
            label: "Se déconnecter",
            icon: LogOut,
            // TEMPORARY (F2): real logout arrives in F3.
            onSelect: () => notify.info("Déconnexion", "Disponible à l'étape F3 (authentification)."),
        },
    ];
    // TEMPORARY (F2): lets you preview the navigation of each role. Removed in F3.
    if (import.meta.env.DEV && setDemoRole) {
        (Object.keys(ROLE_LABELS) as Role[]).forEach((role, index) => {
            items.push({
                label: `Démo : ${ROLE_LABELS[role]}`,
                onSelect: () => setDemoRole(role),
                separatorBefore: index === 0,
                disabled: role === user.role,
            });
        });
    }

    return (
        <Menu
            label="Menu du profil"
            align="end"
            items={items}
            triggerClassName="flex items-center gap-3 border-2 border-ink bg-paper py-1 pl-1 pr-3 hover:bg-gray-light"
            trigger={
                <>
                    <span className="flex size-9 items-center justify-center bg-ink font-display text-sm font-bold text-paper">
                        {initials}
                    </span>
                    <span className="hidden text-left leading-tight sm:block">
                        <span className="block text-sm font-bold">
                            {user.first_name} {user.last_name}
                        </span>
                        <span className="block text-xs text-gray-dark">{ROLE_LABELS[user.role]}</span>
                    </span>
                </>
            }
        />
    );
}

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
    const { user } = useSession();
    const navigate = useNavigate();
    const { alerts, loading } = useAlerts();
    const [query, setQuery] = useState("");
    const canSearch = user.role === "ADMIN" || user.role === "HR";

    function handleSearch(event: FormEvent) {
        event.preventDefault();
        const term = query.trim();
        if (term) navigate(`/employees?search=${encodeURIComponent(term)}`);
    }

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b-2 border-ink bg-paper px-4 md:px-8">
            <button
                type="button"
                onClick={onOpenMenu}
                aria-label="Ouvrir le menu"
                className="border-2 border-ink p-2 hover:bg-ink hover:text-paper lg:hidden"
            >
                <MenuIcon className="size-5" aria-hidden="true" />
            </button>

            {canSearch && (
                <form onSubmit={handleSearch} className="hidden w-full max-w-md sm:block">
                    <SearchInput
                        value={query}
                        onChange={setQuery}
                        label="Rechercher un employé"
                        placeholder="Rechercher un employé…"
                    />
                </form>
            )}

            <div className="ml-auto flex items-center gap-3">
                <AlertsMenu alerts={alerts} loading={loading} />
                <ProfileMenu />
            </div>
        </header>
    );
}