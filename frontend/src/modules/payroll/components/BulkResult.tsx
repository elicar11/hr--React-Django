import { Alert } from "@/components/ui";
import type { BulkError } from "../types";

/** Result of a bulk operation: how many succeeded, and which payslips failed and why. */
export function BulkResult({
    title,
    successLabel,
    count,
    errors,
    extra,
    onDismiss,
}: {
    title: string;
    successLabel: string;
    count: number;
    errors: BulkError[];
    extra?: string;
    onDismiss: () => void;
}) {
    const failed = errors.length > 0;
    return (
        <div className="mb-6 space-y-3">
            <Alert tone={failed ? "warning" : "success"} title={title}>
                <p>
                    {count} {successLabel}
                    {failed ? `, ${errors.length} en erreur.` : "."} {extra}
                </p>
                <button type="button" onClick={onDismiss} className="mt-2 text-sm font-bold underline underline-offset-4">
                    Masquer ce résultat
                </button>
            </Alert>
            {failed && (
                <div role="region" aria-label={`Erreurs : ${title}`} tabIndex={0} className="overflow-x-auto border-2 border-ink bg-paper">
                    <table className="w-full border-collapse text-left text-sm">
                        <caption className="sr-only">Bulletins en erreur</caption>
                        <thead className="bg-ink text-paper">
                            <tr>
                                <th scope="col" className="px-3 py-2">Bulletin</th>
                                <th scope="col" className="px-3 py-2">Matricule</th>
                                <th scope="col" className="px-3 py-2">Problème</th>
                            </tr>
                        </thead>
                        <tbody>
                            {errors.map((error) => (
                                <tr key={error.reference} className="border-t-2 border-ink align-top">
                                    <td className="px-3 py-2 font-bold">{error.reference}</td>
                                    <td className="px-3 py-2">{error.matricule}</td>
                                    <td className="px-3 py-2">{error.detail}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}