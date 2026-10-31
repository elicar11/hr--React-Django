import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { cx } from "@/lib/cx";
import { useLocalStorageState } from "@/lib/hooks/useLocalStorageState";
import { Drawer } from "./Drawer";
import { ErrorBoundary } from "./ErrorBoundary";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppLayout() {
    const [collapsed, setCollapsed] = useLocalStorageState("hr.sidebar.collapsed", false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const location = useLocation();
    const mainRef = useRef<HTMLElement>(null);
    const previousPath = useRef(location.pathname);

    // After a navigation, a single-page app must move the focus itself, otherwise keyboard and
    // screen-reader users stay on the link they clicked. Search-parameter changes do not count.
    useEffect(() => {
        if (previousPath.current === location.pathname) return;
        previousPath.current = location.pathname;
        window.scrollTo(0, 0);
        const frame = requestAnimationFrame(() => {
            const target = mainRef.current?.querySelector<HTMLElement>("h1") ?? mainRef.current;
            if (!target) return;
            if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
            target.focus({ preventScroll: true });
        });
        return () => cancelAnimationFrame(frame);
    }, [location.pathname]);

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
                <main ref={mainRef} id="main" tabIndex={-1} className="flex-1 p-4 md:p-8">
                    {/* The key resets the boundary when the user navigates away from a failed page. */}
                    <ErrorBoundary key={location.pathname}>
                        <Outlet />
                    </ErrorBoundary>
                </main>
            </div>
        </div>
    );
}