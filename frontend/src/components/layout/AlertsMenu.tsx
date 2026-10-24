import { Bell } from "lucide-react";
import { Link } from "react-router";
import { Popover } from "@/components/ui/Popover";
import { Spinner } from "@/components/ui/Spinner";
import type { AlertItem } from "./useAlerts";

export function AlertsMenu({ alerts, loading }: { alerts: AlertItem[]; loading: boolean }) {
    return (
        <Popover
            label={alerts.length > 0 ? `Alertes (${alerts.length})` : "Alertes"}
            align="end"
            panelClassName="w-80 max-w-[calc(100vw-1rem)]"
            triggerClassName="relative border-2 border-ink bg-paper p-2 hover:bg-ink hover:text-paper"
            trigger={
                <>
                    <Bell className="size-5" aria-hidden="true" />
                    {alerts.length > 0 && (
                        <span
                            aria-hidden="true"
                            className="absolute -right-2 -top-2 min-w-5 border-2 border-ink bg-ink px-1 text-xs font-bold text-paper"
                        >
                            {alerts.length}
                        </span>
                    )}
                </>
            }
        >
            {(close) => (
                <div>
                    <p className="border-b-2 border-ink bg-ink px-4 py-2 text-sm font-bold uppercase tracking-wide text-paper">
                        Alertes
                    </p>
                    {loading ? (
                        <div className="flex justify-center p-6">
                            <Spinner />
                        </div>
                    ) : alerts.length === 0 ? (
                        <p className="p-4 text-sm text-gray-dark">Aucune alerte pour le moment.</p>
                    ) : (
                        <ul>
                            {alerts.map((alert) => (
                                <li key={alert.id} className="border-b-2 border-ink last:border-b-0">
                                    {alert.to ? (
                                        <Link to={alert.to} onClick={close} className="block p-4 hover:bg-gray-light">
                                            <span className="block font-bold">{alert.title}</span>
                                            {alert.description && <span className="block text-sm text-gray-dark">{alert.description}</span>}
                                        </Link>
                                    ) : (
                                        <div className="p-4">
                                            <span className="block font-bold">{alert.title}</span>
                                            {alert.description && <span className="block text-sm text-gray-dark">{alert.description}</span>}
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </Popover>
    );
}