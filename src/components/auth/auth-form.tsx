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

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <form action={signInWithGoogle}>
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <Button type="submit" variant="outline" className="w-full">
            {t("continueWithGoogle")}
          </Button>
        </form>

        {/* Offers a returning Google user their account straight away; renders
            nothing when One Tap isn't configured or the browser suppresses it. */}
        <GoogleOneTap redirectTo={redirectTo} />

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
