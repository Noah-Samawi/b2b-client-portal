import { ProtectedArea } from "@/features/auth/protected-area";

export default function SecurityLayout({ children }: LayoutProps<"/security">) {
  return <ProtectedArea allow={["admin", "client"]}>{children}</ProtectedArea>;
}
