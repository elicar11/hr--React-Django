import { LogOut, Menu as MenuIcon, UserCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Menu, type MenuItem } from "@/components/ui/Menu";
import { SearchInput } from "@/components/ui/SearchInput";
import { useAuth } from "@/modules/auth/authContext";
import { useSession } from "@/modules/auth/sessionContext";
import { ROLE_LABELS } from "@/modules/auth/types";
import { AlertsMenu } from "./AlertsMenu";
import { useAlerts } from "./useAlerts";

function ProfileMenu() {
    const { user } = useSession();
    const { logout } = useAuth();
    const navigate = useNavigate();
    const initials = `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase();

    const items: MenuItem[] = [
        { label: "Mon profil", icon: UserCircle, to: "/profile" },
        {
            label: "Se déconnecter",
            icon: LogOut,
            separatorBefore: true,
            onSelect: () => {
                void logout().then(() => navigate("/login", { replace: true }));
            },
        },
    ];

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