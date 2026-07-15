"use client";

import * as React from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";

import { saveProfile, type OnboardingState } from "@/app/onboarding/actions";
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
import { Textarea } from "@/components/ui/textarea";
import type { Profile } from "@/types/database";

function SubmitButton() {
  const t = useTranslations("onboarding");
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? t("saving") : t("save")}
    </Button>
  );
}

export function OnboardingForm({ profile }: { profile: Profile | null }) {
  const t = useTranslations("onboarding");
  const [state, formAction] = useFormState<OnboardingState, FormData>(
    saveProfile,
    null,
  );
  // Fill the hidden timezone field after mount (avoids a hydration mismatch).
  const tzRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (tzRef.current) {
      tzRef.current.value =
        Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    }
  }, []);

  return (
    <Card className="mx-auto w-full max-w-lg">
      <CardHeader>
        <CardTitle className="text-xl">{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="timezone" ref={tzRef} />
          <div className="space-y-2">
            <Label htmlFor="username">{t("username")}</Label>
            <Input
              id="username"
              name="username"
              required
              defaultValue={profile?.username ?? ""}
              placeholder="grower123"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="full_name">{t("fullName")}</Label>
            <Input
              id="full_name"
              name="full_name"
              defaultValue={profile?.full_name ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="birth_date">{t("birthDate")}</Label>
            <Input
              id="birth_date"
              name="birth_date"
              type="date"
              required
              max={new Date().toISOString().split("T")[0]}
              defaultValue={profile?.birth_date ?? ""}
            />
            <p className="text-xs text-muted-foreground">
              {t("birthDateHint")}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">{t("bio")}</Label>
            <Textarea id="bio" name="bio" defaultValue={profile?.bio ?? ""} rows={3} />
          </div>
          <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3">
            <input
              id="accept_terms"
              name="accept_terms"
              type="checkbox"
              required
              className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
            />
            <Label
              htmlFor="accept_terms"
              className="text-xs font-normal leading-relaxed text-muted-foreground"
            >
              {t("acceptTerms")}
            </Label>
          </div>
          {state?.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
