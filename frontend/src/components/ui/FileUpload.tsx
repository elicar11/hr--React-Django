import { useId, useRef, useState, type ChangeEvent } from "react";
import { Button } from "./Button";
import { FieldShell } from "./FieldShell";
import { describedBy } from "./fieldStyles";

export interface FileUploadProps {
    label: string;
    hint?: string;
    error?: string;
    /** e.g. ".pdf,.png,.jpg". The backend remains the real validator. */
    accept?: string;
    maxSizeMb?: number;
    file: File | null;
    onChange: (file: File | null) => void;
    required?: boolean;
}

export function FileUpload({ label, hint, error, accept, maxSizeMb = 5, file, onChange, required }: FileUploadProps) {
    const id = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const [localError, setLocalError] = useState<string>();
    const message = error ?? localError;
    const help = hint ?? (accept ? `Formats : ${accept}. ${maxSizeMb} Mo maximum.` : `${maxSizeMb} Mo maximum.`);

    function handleChange(event: ChangeEvent<HTMLInputElement>) {
        const selected = event.target.files?.[0] ?? null;
        // UX only: the API validates type, content and size again.
        if (selected && selected.size > maxSizeMb * 1024 * 1024) {
            setLocalError(`Le fichier dépasse ${maxSizeMb} Mo.`);
            event.target.value = "";
            onChange(null);
            return;
        }
        setLocalError(undefined);
        onChange(selected);
    }

    function clear() {
        if (inputRef.current) inputRef.current.value = "";
        setLocalError(undefined);
        onChange(null);
    }

    return (
        <FieldShell id={id} label={label} hint={help} error={message} required={required}>
            <div className="flex flex-wrap items-center gap-3 border-2 border-dashed border-ink bg-paper p-3">
                <input
                    ref={inputRef}
                    id={id}
                    type="file"
                    accept={accept}
                    onChange={handleChange}
                    aria-invalid={message ? true : undefined}
                    aria-describedby={describedBy(id, help, message)}
                    className="min-w-0 flex-1 text-sm file:mr-3 file:cursor-pointer file:border-2 file:border-ink file:bg-ink file:px-3 file:py-1.5 file:text-xs file:font-bold file:uppercase file:text-paper"
                />
                {file && (
                    <Button size="sm" variant="secondary" onClick={clear}>
                        Retirer
                    </Button>
                )}
            </div>
        </FieldShell>
    );
}