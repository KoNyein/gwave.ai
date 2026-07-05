import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth";

export default async function SocialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return <AppShell>{children}</AppShell>;
}
