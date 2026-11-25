import Link from "next/link";
import { de } from "@/i18n/de";

export function PublicFooter() {
  return (
    <footer className="border-t border-border px-4 py-4 text-xs text-muted-foreground">
      <nav aria-label={de.legal.footer} className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <Link href="/impressum" className="hover:text-foreground">{de.legal.impressum}</Link>
        <Link href="/datenschutz" className="hover:text-foreground">Datenschutz</Link>
        <Link href="/agb" className="hover:text-foreground">AGB</Link>
      </nav>
    </footer>
  );
}
