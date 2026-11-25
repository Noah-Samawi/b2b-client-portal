import { ProtectedArea } from "@/features/auth/protected-area";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <ProtectedArea allow={["admin"]}>{children}</ProtectedArea>;
}
