"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getDataSource, isPortalError, type Role, type SessionStatus, type User } from "@/lib/data";
import { clearRoleCookie, homeFor, setRoleCookie } from "@/lib/session/route-cookie";

type SessionState =
  | { status: "loading" }
  | { status: "signed-out"; reason?: "expired" | "required" | "mfa" }
  | { status: "signed-in"; session: SessionStatus };

interface SessionApi {
  state: SessionState;
  user: User | null;
  /** Re-reads the session from the data source. */
  refresh: () => Promise<SessionState>;
  /** Called after a completed login (incl. second factor). */
  completeSignIn: (user: User) => void;
  signOut: (reason?: "idle" | "expired" | "signedOut") => Promise<void>;
}

const SessionContext = React.createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = React.useState<SessionState>({ status: "loading" });

  const refresh = React.useCallback(async (): Promise<SessionState> => {
    try {
      const session = await getDataSource().getSessionStatus();
      const needsAal2 = session.user.role === "admin" || session.user.mfaEnrolled;
      if (needsAal2 && session.aal !== "aal2") {
        // Password step done but second factor missing: not a usable session.
        clearRoleCookie();
        const next: SessionState = { status: "signed-out", reason: "mfa" };
        setState(next);
        return next;
      }
      setRoleCookie(session.user.role);
      const next: SessionState = { status: "signed-in", session };
      setState(next);
      return next;
    } catch (err) {
      clearRoleCookie();
      const reason = isPortalError(err) && err.code === "SESSION_EXPIRED" ? "expired" : "required";
      const next: SessionState = { status: "signed-out", reason };
      setState(next);
      return next;
    }
  }, []);

  const completeSignIn = React.useCallback(
    (user: User) => {
      setRoleCookie(user.role);
      void refresh().then(() => router.replace(homeFor(user.role)));
    },
    [refresh, router],
  );

  const signOut = React.useCallback(
    async (reason: "idle" | "expired" | "signedOut" = "signedOut") => {
      try {
        await getDataSource().signOut();
      } finally {
        clearRoleCookie();
        setState({ status: "signed-out" });
        router.replace(`/login?reason=${reason}`);
      }
    },
    [router],
  );

  const api = React.useMemo<SessionApi>(
    () => ({
      state,
      user: state.status === "signed-in" ? state.session.user : null,
      refresh,
      completeSignIn,
      signOut,
    }),
    [state, refresh, completeSignIn, signOut],
  );

  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionApi {
  const ctx = React.useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}

export function useRequiredUser(): User {
  const { user } = useSession();
  if (!user) throw new Error("useRequiredUser used outside an authenticated area");
  return user;
}

export type { Role };
