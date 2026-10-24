import { Spinner } from "@/components/ui/Spinner";

export function FullPageSpinner({ label = "Chargement de la session…" }: { label?: string }) {
    return (
        <div className="flex min-h-dvh items-center justify-center">
            <Spinner size="lg" label={label} />
        </div>
    );
}