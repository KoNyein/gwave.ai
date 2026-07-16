"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";

import {
  changePassword,
  requestPasswordReset,
  updatePassword,
  type RecoveryState,
} from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/** Maps the action's sentinel errors to localized text. */
function errorText(
  error: string,
  t: ReturnType<typeof useTranslations<"auth">>,
): string {
  if (error === "PASSWORDS_DO_NOT_MATCH") return t("passwordsDontMatch");
  if (error === "SESSION_EXPIRED") return t("recoverySessionExpired");
  return error;
}

/** Step 1 — request a reset link by email (/forgot-password). */
export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [state, formAction] = useFormState<RecoveryState, FormData>(
    requestPasswordReset,
    null,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("forgotTitle")}</CardTitle>
        <CardDescription>{t("forgotDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state && "ok" in state ? (
          <div className="rounded-lg bg-primary/10 p-4 text-sm">
            📬 {t("resetEmailSent")}
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
              />
            </div>
            {state?.error ? (
              <p className="text-sm text-destructive" role="alert">
                {errorText(state.error, t)}
              </p>
            ) : null}
            <SubmitButton
              label={t("sendResetLink")}
              pendingLabel={t("sendingResetLink")}
            />
          </form>
        )}
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t("backToLogin")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Step 2 — choose a new password. Used on /reset-password (recovery link
 * session) and inside Settings → Security (normal session).
 */
export function UpdatePasswordForm({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("auth");
  // Settings (compact) changes the password of the signed-in user; the recovery
  // page confirms an emailed code, so it also collects the email + code.
  const [state, formAction] = useFormState<RecoveryState, FormData>(
    compact ? changePassword : updatePassword,
    null,
  );

  const form =
    state && "ok" in state ? (
      <div className="rounded-lg bg-primary/10 p-4 text-sm">
        ✅ {t("passwordUpdated")}{" "}
        {!compact ? (
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t("backToLogin")}
          </Link>
        ) : null}
      </div>
    ) : (
      <form action={formAction} className="space-y-4">
        {!compact ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="reset-email">{t("email")}</Label>
              <Input
                id="reset-email"
                name="email"
                type="email"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-code">{t("resetCode")}</Label>
              <Input
                id="reset-code"
                name="code"
                inputMode="numeric"
                required
                autoComplete="one-time-code"
              />
            </div>
          </>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="new-password">{t("newPassword")}</Label>
          <Input
            id="new-password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">{t("confirmPassword")}</Label>
          <Input
            id="confirm-password"
            name="confirm"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        {state?.error ? (
          <p className="text-sm text-destructive" role="alert">
            {errorText(state.error, t)}
          </p>
        ) : null}
        <SubmitButton
          label={t("updatePassword")}
          pendingLabel={t("updatingPassword")}
        />
      </form>
    );

  if (compact) return form;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t("resetTitle")}</CardTitle>
        <CardDescription>{t("resetDesc")}</CardDescription>
      </CardHeader>
      <CardContent>{form}</CardContent>
    </Card>
  );
}
