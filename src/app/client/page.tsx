import type { Metadata } from "next";
import { ClientDashboard } from "@/features/client/client-dashboard";
import { de } from "@/i18n/de";

export const metadata: Metadata = { title: de.dashboard.clientTitle };

export default function ClientPage() {
  return <ClientDashboard />;
}
