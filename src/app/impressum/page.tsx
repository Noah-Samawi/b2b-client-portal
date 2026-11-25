import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { de } from "@/i18n/de";

export const metadata: Metadata = { title: de.legal.impressum };

export default function Impressum() {
  return (
    <LegalPage
      title={de.legal.impressum}
      sections={[
        { heading: "Angaben gemäß § 5 DDG", body: "[PLATZHALTER] Name / Firma, Anschrift, Kontakt (E-Mail, Telefon). Bitte vollständig ergänzen." },
        { heading: "Vertretungsberechtigt", body: "[PLATZHALTER] Inhaber/in bzw. Geschäftsführung." },
        { heading: "Umsatzsteuer-ID / Register", body: "[PLATZHALTER] Falls vorhanden: USt-IdNr., Registergericht, Registernummer." },
        { heading: "Verantwortlich für den Inhalt", body: "[PLATZHALTER] Name und Anschrift der verantwortlichen Person." },
      ]}
    />
  );
}
