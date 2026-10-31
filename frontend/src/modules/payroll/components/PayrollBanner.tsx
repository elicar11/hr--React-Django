import { Link } from "react-router";
import { Alert } from "@/components/ui";
import { usePayrollSettings } from "../hooks";

/** Permanent warning at the top of every payroll screen while the settings are fictitious or missing. */
export function PayrollBanner() {
    const { data } = usePayrollSettings();
    if (!data) return null;

    if (!data.currency) {
        return (
            <Alert tone="warning" title="Paramètres de paie non configurés" className="mb-6">
                La devise n'est pas définie : aucun bulletin ne peut être généré.{" "}
                <Link to="/payroll/settings" className="font-bold underline underline-offset-4">
                    Configurer la paie
                </Link>
            </Alert>
        );
    }
    if (data.is_demo) {
        return (
            <Alert tone="warning" title="DÉMO : paramètres fictifs, non utilisables pour une paie réelle" className="mb-6">
                Les taux, cotisations et impôts présents ici sont de démonstration. Ne les utilisez pas pour payer de vrais salaires.
            </Alert>
        );
    }
    return null;
}