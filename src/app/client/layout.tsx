import { ProtectedArea } from "@/features/auth/protected-area";

export default function ClientLayout({ children }: LayoutProps<"/client">) {
  return <ProtectedArea allow={["client"]}>{children}</ProtectedArea>;
}
