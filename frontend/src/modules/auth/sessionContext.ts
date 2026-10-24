import { useAuth } from "../auth/authContext";
import type { User } from "./types";

/** For components rendered inside the authenticated area: the user is always defined. */
export function useSession(): { user: User } {
    const { user } = useAuth();
    if (!user) throw new Error("useSession must be used inside the authenticated area");
    return { user };
}