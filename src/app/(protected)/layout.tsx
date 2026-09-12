import { AppShell } from "@/components/app-shell";
import { requireCurrentUser } from "@/core/auth/session";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireCurrentUser();
  return <AppShell user={user}>{children}</AppShell>;
}
