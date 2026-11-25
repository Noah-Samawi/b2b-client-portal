import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { de } from "@/i18n/de";

export const metadata: Metadata = { title: de.legal.agb };

export default function Agb() {
  return (
    <LegalPage
      title={de.legal.agb}
      sections={[
        { heading: "§ 1 Geltungsbereich", body: "[PLATZHALTER] Diese Bedingungen gelten für die Nutzung des Kundenportals durch Geschäftskunden." },
        { heading: "§ 2 Leistungen", body: "[PLATZHALTER] Bereitstellung des Portals zur Projektabstimmung, Dateiübergabe und Freigabe." },
        { heading: "§ 3 Pflichten der Nutzer", body: "[PLATZHALTER] Vertraulicher Umgang mit Zugangsdaten, keine Schadsoftware hochladen." },
        { heading: "§ 4 Haftung", body: "[PLATZHALTER] Haftungsregelungen durch Rechtsberatung festlegen lassen." },
      ]}
    />
  );
}
