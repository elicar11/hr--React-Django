import { useState } from "react";
import { Outlet } from "react-router";
import { cx } from "@/lib/cx";
import { useLocalStorageState } from "@/lib/hooks/useLocalStorageState";
import { Drawer } from "./Drawer";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppLayout() {
    const [collapsed, setCollapsed] = useLocalStorageState("hr.sidebar.collapsed", false);
    const [drawerOpen, setDrawerOpen] = useState(false);

    return (
        <div className="min-h-dvh lg:flex">
            <a
                href="#main"
                className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:border-2 focus:border-ink focus:bg-paper focus:px-4 focus:py-2 focus:font-bold"
            >
                Aller au contenu
            </a>

            <aside
                className={cx(
                    "sticky top-0 hidden h-dvh shrink-0 transition-[width] duration-150 lg:block",
                    collapsed ? "w-[4.5rem]" : "w-64",
                )}
            >
                <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
            </aside>

            <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} label="Menu de navigation">
                <Sidebar onNavigate={() => setDrawerOpen(false)} />
            </Drawer>

            <div className="flex min-w-0 flex-1 flex-col">
                <Topbar onOpenMenu={() => setDrawerOpen(true)} />
                <main id="main" tabIndex={-1} className="flex-1 p-4 md:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}