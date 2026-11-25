"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import type { Role } from "@/lib/data";
import { homeFor } from "@/lib/session/route-cookie";
import { useSession } from "./session-context";
import { Skeleton } from "@/components/ui/primitives";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { de } from "@/i18n/de";

/**
 * Client-side route guard. It is a UX layer only: every data call is authorized again
 * inside the data source (Phase 2: RLS + server checks), so bypassing this guard exposes nothing.
 */
export function AuthGuard({ allow, children }: { allow: Role[]; children: React.ReactNode }) {
  const { state, refresh } = useSession();
  const router = useRouter();

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    if (state.status === "signed-out") {
      router.replace(`/login?reason=${state.reason === "expired" ? "expired" : "required"}`);
    }
  }, [state, router]);

  if (state.status !== "signed-in") {
    return (
      <div className="mx-auto grid w-full max-w-5xl gap-4 p-6" aria-busy="true" aria-label={de.common.loading}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const role = state.session.user.role;
  if (!allow.includes(role)) {
    return (
      <div className="mx-auto w-full max-w-xl p-6">
        <EmptyState
          icon={ShieldAlert}
          title={de.errors.forbiddenTitle}
          description={de.errors.forbiddenText}
          action={
            <Button onClick={() => router.replace(homeFor(role))}>{de.errors.toHome}</Button>
          }
        />
      </div>
    );
  }

  return <>{children}</>;
}
