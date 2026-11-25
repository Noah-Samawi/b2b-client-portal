"use client";

import Link from "next/link";
import { AlertOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { de } from "@/i18n/de";

/** Route-level error boundary. Error details are not shown to users (no data leakage). */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";
  return (
    <main id="main" className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-4 text-center" role="alert">
      <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/10">
        <AlertOctagon className="size-6 text-destructive" aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-semibold">{de.errors.pageTitle}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{de.errors.pageText}</p>
      {digest ? <p className="font-mono text-xs text-muted-foreground">Ref: {digest}</p> : null}
      <div className="flex gap-2">
        <Button onClick={() => retry()}>{de.common.retry}</Button>
        <Button asChild variant="outline">
          <Link href="/">{de.errors.toHome}</Link>
        </Button>
      </div>
    </main>
  );
}
