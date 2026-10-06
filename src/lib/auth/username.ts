import "server-only";
import type { User } from "@supabase/supabase-js";
import { usernameSchema } from "./validation";

// Auth accepts email/phone identities; .invalid is reserved and cannot receive mail.
// Never display this identifier as a contact email or send mail to it.
export const USERNAME_AUTH_DOMAIN = "username.toonshelf.invalid";
export function usernameAuthEmail(username: string) {
  return `${usernameSchema.parse(username)}@${USERNAME_AUTH_DOMAIN}`;
}
export function isUsernameAccount(user: Pick<User, "app_metadata" | "email">) {
  return user.app_metadata?.toonshelf?.auth_mode === "username"
    || Boolean(user.email?.endsWith(`@${USERNAME_AUTH_DOMAIN}`));
}
