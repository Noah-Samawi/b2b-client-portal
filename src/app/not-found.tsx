import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { de } from "@/i18n/de";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-secondary">
        <SearchX className="size-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="text-2xl font-semibold">{de.errors.notFoundTitle}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{de.errors.notFoundText}</p>
      <Button asChild>
        <Link href="/">{de.errors.toHome}</Link>
      </Button>
    </main>
  );
}
