import type { Role, User } from "@/modules/auth/types";

/** Answer of the account creation (the API returns fewer fields than for a read). */
export type UserSummary = Pick<User, "id" | "email" | "first_name" | "last_name" | "role">;

export interface UserCreateInput {
    email: string;
    first_name: string;
    last_name: string;
    role: Role;
    password: string;
}

/** `role` is left out when an administrator edits their own account (the API refuses it). */
export interface UserUpdateInput {
    email: string;
    first_name: string;
    last_name: string;
    role?: Role;
}