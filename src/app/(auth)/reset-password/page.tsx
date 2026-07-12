import { redirect } from "next/navigation";

import { UpdatePasswordForm } from "@/components/auth/password-reset";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Reset password" };
export const dynamic = "force-dynamic";

/**
 * Landing page of the emailed recovery link (via /auth/callback, which has
 * already exchanged the code for a session). Without a session the link is
 * expired/used — send the user back to request a fresh one.
 */
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/forgot-password");

  return <UpdatePasswordForm />;
}
