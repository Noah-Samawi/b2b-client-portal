import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/features/auth/login-form";
import { PublicFooter } from "@/components/public-footer";
import { Skeleton } from "@/components/ui/primitives";
import { de } from "@/i18n/de";

export const metadata: Metadata = { title: de.login.title };

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <main id="main" className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
        <div className="text-center">
          <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground" aria-hidden="true">
            K
          </div>
          <h1 className="text-2xl font-semibold">{de.app.name}</h1>
          <p className="text-sm text-muted-foreground">{de.app.tagline}</p>
        </div>
        <Suspense fallback={<Skeleton className="h-96 w-full max-w-md" />}>
          <LoginForm />
        </Suspense>
      </main>
      <PublicFooter />
    </div>
  );
}
