"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";

import { login, register, signInWithGoogle, type AuthState } from "@/app/(auth)/actions";
import { GoogleOneTap } from "@/components/auth/google-one-tap";
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

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

/** The Google "G" brand mark (colored). */
function GoogleMark() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/feed";
  const oauthError = searchParams.get("error");
  const oauthReason = searchParams.get("reason");

  const action = mode === "login" ? login : register;
  const [state, formAction] = useFormState<AuthState, FormData>(action, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          {mode === "login" ? t("loginTitle") : t("registerTitle")}
        </CardTitle>
        <CardDescription>{t(mode === "login" ? "login" : "register")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* An OAuth failure used to be invisible: the callback set ?error= and
            nothing ever rendered it, so Google refusing the sign-in looked
            exactly like nothing happening. Show it, with Google's own reason. */}
        {oauthError ? (
          <div
            role="alert"
            className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm"
          >
            <p className="font-medium text-destructive">{t("oauthFailed")}</p>
            {oauthReason ? (
              <p className="text-xs text-muted-foreground">{oauthReason}</p>
            ) : null}
          </div>
        ) : null}

        {/* Google is the primary, fastest path — lead with it. */}
        <form action={signInWithGoogle}>
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <Button
            type="submit"
            variant="outline"
            className="h-11 w-full gap-2 text-base font-medium"
          >
            <GoogleMark /> {t("continueWithGoogle")}
          </Button>
        </form>

        {/* Offers a returning Google user their account straight away; renders
            nothing when One Tap isn't configured or the browser suppresses it. */}
        <GoogleOneTap redirectTo={redirectTo} />

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              {t("orEmail")}
            </span>
          </div>
        </div>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>
          {state?.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
          {mode === "login" ? (
            <p className="text-right text-sm">
              <Link
                href="/forgot-password"
                className="text-muted-foreground hover:text-primary hover:underline"
              >
                {t("forgotPassword")}
              </Link>
            </p>
          ) : null}
          <SubmitButton
            label={mode === "login" ? t("login") : t("register")}
            pendingLabel={mode === "login" ? t("loggingIn") : t("registering")}
          />
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {mode === "login" ? t("noAccount") : t("haveAccount")}{" "}
          <Link
            href={mode === "login" ? "/register" : "/login"}
            className="font-medium text-primary hover:underline"
          >
            {mode === "login" ? t("register") : t("login")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
