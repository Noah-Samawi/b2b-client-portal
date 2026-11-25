import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { de } from "@/i18n/de";

export const metadata: Metadata = { title: de.legal.datenschutz };

export default function Datenschutz() {
  return (
    <LegalPage
      title={de.legal.datenschutz}
      sections={[
        { heading: "1. Verantwortlicher", body: "[PLATZHALTER] Name und Kontaktdaten des Verantwortlichen nach Art. 4 Nr. 7 DSGVO." },
        { heading: "2. Verarbeitete Daten", body: "[PLATZHALTER] Kontodaten (Name, E-Mail), Projektdaten, hochgeladene Dokumente, Protokolldaten (Audit-Log)." },
        { heading: "3. Zwecke und Rechtsgrundlagen", body: "[PLATZHALTER] Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO), berechtigte Interessen (lit. f), gesetzliche Pflichten (lit. c)." },
        { heading: "4. Auftragsverarbeiter und Hosting", body: "[PLATZHALTER] Hosting-, Datenbank-, Speicher- und E-Mail-Anbieter, Serverstandorte, Auftragsverarbeitungsverträge, ggf. Drittlandübermittlungen. In Phase 2 mit der tatsächlichen Infrastruktur abgleichen." },
        { heading: "5. Speicherdauer und Löschung", body: "[PLATZHALTER] Konfigurierbare Aufbewahrungsfrist, Löschprozess, Aufbewahrung von Audit-Einträgen." },
        { heading: "6. Rechte der betroffenen Personen", body: "[PLATZHALTER] Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit, Widerspruch, Beschwerde bei einer Aufsichtsbehörde." },
      ]}
    />
  );
}
