import type { Metadata } from "next";
import { AdminDashboard } from "@/features/admin/admin-dashboard";
import { de } from "@/i18n/de";

export const metadata: Metadata = { title: de.dashboard.adminTitle };

export default function AdminPage() {
  return <AdminDashboard />;
}
