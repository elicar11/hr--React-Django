import { Trash2 } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { formatDecimal, formatMoney } from "@/lib/format";
import { CATEGORY_LABELS, lineKind, type LineKind } from "../payrollLabels";
import type { Payslip, PayslipLine } from "../types";

const SECTIONS: { kind: LineKind; title: string }[] = [
    { kind: "earning", title: "Gains" },
    { kind: "adjustment", title: "Retenues sur absence (réduisent le brut)" },
    { kind: "deduction", title: "Retenues" },
];

function Section({
    title,
    lines,
    currency,
    onRemoveLine,
}: {
    title: string;
    lines: PayslipLine[];
    currency: string;
    onRemoveLine?: (line: PayslipLine) => void;
}) {
    return (
        <section className="border-2 border-ink bg-paper">
            <h3 className="border-b-2 border-ink bg-ink px-4 py-2 text-base text-paper">{title}</h3>
            <div role="region" aria-label={title} tabIndex={0} className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                    <caption className="sr-only">{title}</caption>
                    <thead>
                        <tr className="border-b-2 border-ink bg-gray-light">
                            <th scope="col" className="px-4 py-2">Libellé</th>
                            <th scope="col" className="px-4 py-2">Base</th>
                            <th scope="col" className="px-4 py-2">Taux</th>
                            <th scope="col" className="px-4 py-2">Quantité</th>
                            <th scope="col" className="px-4 py-2 text-right">Montant</th>
                            {onRemoveLine && <th scope="col" className="px-4 py-2"><span className="sr-only">Actions</span></th>}
                        </tr>
                    </thead>
                    <tbody>
                        {lines.map((line) => (
                            <tr key={line.id} className="border-t-2 border-ink align-top">
                                <td className="px-4 py-2">
                                    <p className="font-bold">
                                        {line.label} {line.is_manual && <Badge tone="dashed">Saisie manuelle</Badge>}
                                    </p>
                                    <p className="text-xs text-gray-dark">
                                        {CATEGORY_LABELS[line.category]}
                                        {line.note ? ` · ${line.note}` : ""}
                                    </p>
                                </td>
                                <td className="px-4 py-2">{line.base_amount !== null ? formatMoney(line.base_amount, currency) : "—"}</td>
                                <td className="px-4 py-2">{line.rate !== null ? `${formatDecimal(line.rate, 4)} %` : "—"}</td>
                                <td className="px-4 py-2">{line.quantity !== null ? formatDecimal(line.quantity) : "—"}</td>
                                <td className="px-4 py-2 text-right font-bold">{formatMoney(line.amount, currency)}</td>
                                {onRemoveLine && (
                                    <td className="px-4 py-2 text-right">
                                        {line.is_manual && (
                                            <Button
                                                size="sm"
                                                variant="danger"
                                                aria-label={`Retirer la ligne ${line.label}`}
                                                onClick={() => onRemoveLine(line)}
                                                leftIcon={<Trash2 className="size-4" aria-hidden="true" />}
                                            >
                                                Retirer
                                            </Button>
                                        )}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

/** Lines and totals of a payslip. Every figure comes from the API: nothing is recomputed here. */
export function PayslipView({
    payslip,
    onRemoveLine,
}: {
    payslip: Payslip;
    /** Only given when the payslip is editable (draft or calculated, ADMIN / HR). */
    onRemoveLine?: (line: PayslipLine) => void;
}) {
    const currency = payslip.currency;
    return (
        <div className="space-y-5">
            {payslip.lines.length === 0 ? (
                <p className="border-2 border-dashed border-ink p-6 text-center text-gray-dark">
                    Ce bulletin n'a pas encore de lignes : lancez le calcul.
                </p>
            ) : (
                SECTIONS.map(({ kind, title }) => {
                    const lines = payslip.lines.filter((line) => lineKind(line.category) === kind);
                    return lines.length > 0 ? (
                        <Section key={kind} title={title} lines={lines} currency={currency} onRemoveLine={onRemoveLine} />
                    ) : null;
                })
            )}

            <dl className="grid gap-4 sm:grid-cols-3">
                <div className="border-2 border-ink bg-paper p-4">
                    <dt className="text-xs font-bold uppercase tracking-widest text-gray-dark">Salaire brut</dt>
                    <dd className="mt-1 font-display text-3xl font-bold">{formatMoney(payslip.gross_pay, currency)}</dd>
                </div>
                <div className="border-2 border-ink bg-paper p-4">
                    <dt className="text-xs font-bold uppercase tracking-widest text-gray-dark">Total des retenues</dt>
                    <dd className="mt-1 font-display text-3xl font-bold">{formatMoney(payslip.total_deductions, currency)}</dd>
                </div>
                <div className="border-2 border-ink bg-ink p-4 text-paper shadow-hard">
                    <dt className="text-xs font-bold uppercase tracking-widest">Net à payer</dt>
                    <dd className="mt-1 font-display text-4xl font-bold">{formatMoney(payslip.net_pay, currency)}</dd>
                </div>
            </dl>
        </div>
    );
}