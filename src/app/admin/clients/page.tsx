import type { Metadata } from "next";
import { ClientsPage } from "@/features/admin/clients-page";
import { de } from "@/i18n/de";

export const metadata: Metadata = { title: de.clients.title };

export default function AdminClientsPage() {
  return <ClientsPage />;
}
