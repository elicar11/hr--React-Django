import type { FormEventHandler, ReactNode } from "react";

/**
 * Body of a form shown in a <Modal padded={false}>: fields, then a footer with the buttons.
 * The form state lives inside it, so it is reset each time the modal opens.
 */
export function ModalForm({
    onSubmit,
    footer,
    children,
}: {
    onSubmit: FormEventHandler<HTMLFormElement>;
    footer: ReactNode;
    children: ReactNode;
}) {
    return (
        <form noValidate onSubmit={onSubmit}>
            <div className="space-y-4 p-5">{children}</div>
            <div className="flex flex-wrap justify-end gap-3 border-t-2 border-ink bg-gray-light p-4">{footer}</div>
        </form>
    );
}