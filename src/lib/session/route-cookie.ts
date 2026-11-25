import type { Role } from "@/lib/data/types";

/**
 * Non-sensitive routing hint for src/proxy.ts (optimistic redirects only).
 * It is NOT an authorization mechanism: the data layer re-checks every call.
 * Phase 2 replaces this with the Supabase session cookie read via @supabase/ssr.
 */
export const ROLE_COOKIE = "kp_role";

export function setRoleCookie(role: Role): void {
  document.cookie = `${ROLE_COOKIE}=${role}; Path=/; SameSite=Lax`;
}

export function clearRoleCookie(): void {
  document.cookie = `${ROLE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function homeFor(role: Role): "/admin" | "/client" {
  return role === "admin" ? "/admin" : "/client";
}
