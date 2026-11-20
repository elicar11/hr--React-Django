import logoUrl from "@/assets/logo.png";
import { cx } from "@/lib/cx";

/** App logo. Decorative by default: the text next to it (or the link's aria-label) names the app. */
export function Logo({ className, alt = "" }: { className?: string; alt?: string }) {
    return <img src={logoUrl} alt={alt} width={64} height={64} className={cx("shrink-0 object-contain", className)} />;
}