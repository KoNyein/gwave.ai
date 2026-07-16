import { UpdatePasswordForm } from "@/components/auth/password-reset";

export const metadata = { title: "Reset password" };
export const dynamic = "force-dynamic";

/**
 * Account recovery step 2. The user arrives here from the reset email, which
 * carries a verification code (Cognito's ForgotPassword flow). The form collects
 * the email, that code and a new password — no session is required, since the
 * whole point is that the user has lost access.
 */
export default async function ResetPasswordPage() {
  return <UpdatePasswordForm />;
}
