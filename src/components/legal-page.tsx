import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { PublicFooter } from "@/components/public-footer";
import { de } from "@/i18n/de";

export function LegalPage({ title, sections }: { title: string; sections: { heading: string; body: string }[] }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <Link href="/login" className="mb-6 flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {de.common.back}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <div role="note" className="my-6 flex gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-warning" data-testid="legal-review-note">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">{de.legal.reviewNote}</p>
            <p className="text-sm">{de.legal.placeholderNote}</p>
          </div>
        </div>
        <div className="grid gap-6">
          {sections.map((s) => (
            <section key={s.heading} className="grid gap-2">
              <h2 className="text-lg font-medium">{s.heading}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </section>
          ))}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
