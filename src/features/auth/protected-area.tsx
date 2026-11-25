"use client";

import * as React from "react";
import type { Role } from "@/lib/data";
import { AppShell } from "@/components/app-shell";
import { AuthGuard } from "./auth-guard";
import { useSession } from "./session-context";
import { IdleTimeout } from "@/features/session/idle-timeout";

/** Guard + shell + idle timeout for every authenticated route group. */
export function ProtectedArea({ allow, children }: { allow: Role[]; children: React.ReactNode }) {
  return (
    <AuthGuard allow={allow}>
      <ShellWithUser>{children}</ShellWithUser>
    </AuthGuard>
  );
}

function ShellWithUser({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useSession();
  if (!user) return null;
  return (
    <AppShell user={user} onSignOut={() => void signOut("signedOut")}>
      {children}
      <IdleTimeout />
    </AppShell>
  );
}
