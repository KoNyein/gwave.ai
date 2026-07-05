"use client";

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

  return (
    <Card className="mx-auto w-full max-w-lg">
      <CardHeader>
        <CardTitle className="text-xl">{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
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
            <Label htmlFor="avatar_url">{t("avatarUrl")}</Label>
            <Input
              id="avatar_url"
              name="avatar_url"
              type="url"
              defaultValue={profile?.avatar_url ?? ""}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">{t("bio")}</Label>
            <Textarea id="bio" name="bio" defaultValue={profile?.bio ?? ""} rows={3} />
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
