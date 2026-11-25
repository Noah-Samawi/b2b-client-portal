import type { Metadata } from "next";
import { SecurityPage } from "@/features/security/security-page";
import { de } from "@/i18n/de";

export const metadata: Metadata = { title: de.security.title };

export default function Security() {
  return <SecurityPage />;
}
