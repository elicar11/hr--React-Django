import { Toaster as Sonner } from "sonner";

/** Discreet, accessible notifications (aria-live) styled like the rest of the app. */
export function Toaster() {
    return (
        <Sonner
            position="bottom-right"
            theme="light"
            toastOptions={{
                unstyled: true,
                classNames: {
                    toast:
                        "flex w-full items-start gap-3 border-2 border-ink p-4 font-sans text-sm shadow-hard",
                    title: "font-bold",
                    description: "text-sm",
                    default: "bg-paper text-ink",
                    success: "bg-paper text-ink",
                    // Errors invert the colors: shape and contrast, not hue.
                    error: "bg-ink text-paper",
                    warning: "bg-gray-light text-ink",
                    info: "bg-paper text-ink",
                },
            }}
        />
    );
}