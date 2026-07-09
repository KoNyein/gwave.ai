"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { applyToTeach } from "@/lib/actions/teachers";
import type { TeacherApplication } from "@/types/database";

/** Apply (or resubmit after rejection) to become a teacher. */
export function TeachApplyForm({
  existing,
}: {
  existing?: TeacherApplication | null;
}) {
  const t = useTranslations("learn");
  const router = useRouter();
  const [bio, setBio] = React.useState(existing?.bio ?? "");
  const [subjects, setSubjects] = React.useState(existing?.subjects ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await applyToTeach({ bio, subjects });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="teach-subjects">{t("teachSubjects")}</Label>
        <Input
          id="teach-subjects"
          value={subjects}
          onChange={(event) => setSubjects(event.target.value)}
          placeholder={t("teachSubjectsPlaceholder")}
          maxLength={200}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="teach-bio">{t("teachBio")}</Label>
        <Textarea
          id="teach-bio"
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          placeholder={t("teachBioPlaceholder")}
          maxLength={1000}
          rows={4}
          required
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending || !bio.trim()}>
        {pending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <GraduationCap className="mr-2 h-4 w-4" />
        )}
        {existing ? t("resubmitApplication") : t("submitApplication")}
      </Button>
    </form>
  );
}
