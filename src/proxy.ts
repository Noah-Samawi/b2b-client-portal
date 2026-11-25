import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic route separation (PHASE 1).
 * Reads a non-sensitive routing hint cookie set after sign-in. It is NOT a security boundary:
 * the data layer authorizes every call, and Phase 2 replaces this with @supabase/ssr session checks.
 */
const ROLE_COOKIE = "kp_role";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const role = request.cookies.get(ROLE_COOKIE)?.value;
  const home = role === "admin" ? "/admin" : role === "client" ? "/client" : null;

  if (!home) {
    const url = new URL("/login", request.url);
    url.searchParams.set("reason", "required");
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/admin") && role !== "admin") return NextResponse.redirect(new URL(home, request.url));
  if (pathname.startsWith("/client") && role !== "client") return NextResponse.redirect(new URL(home, request.url));

  const res = NextResponse.next();
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/client/:path*", "/security/:path*"],
};
