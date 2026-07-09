"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Subjects a teacher can tag a class with (mirrors the Learn track slugs). */
const SUBJECTS = [
  { slug: "", label: "General" },
  { slug: "html", label: "HTML" },
  { slug: "css", label: "CSS" },
  { slug: "javascript", label: "JavaScript" },
  { slug: "python", label: "Python" },
  { slug: "stem", label: "STEM" },
  { slug: "electronics-iot", label: "Electronics & IoT" },
  { slug: "robotics", label: "Robotics & AI" },
  { slug: "agri", label: "Agri-Science" },
];

/**
 * Teacher-only form to start a live class. Reuses /api/live/create with
 * kind:"class"; on success it jumps to the host view (RTMP URL + key) that
 * the streaming feature already provides.
 */
export function StartClassForm() {
  const t = useTranslations("learn");
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/live/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          kind: "class",
          trackSlug: subject || undefined,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        id?: string;
        error?: string;
      } | null;
      if (!response.ok || !body?.id) {
        throw new Error(body?.error ?? "Failed to start the class.");
      }
      router.push(`/live/${body.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start the class.",
      );
      setPending(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="class-title">{t("classTitle")}</Label>
            <Input
              id="class-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("classTitlePlaceholder")}
              maxLength={120}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="class-subject">{t("classSubject")}</Label>
            <select
              id="class-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {SUBJECTS.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="class-description">{t("classDescription")}</Label>
            <Textarea
              id="class-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("classDescriptionPlaceholder")}
              maxLength={1000}
              rows={3}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="submit"
            className="w-full"
            disabled={pending || !title.trim()}
          >
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <GraduationCap className="mr-2 h-4 w-4" />
            )}
            {t("startClass")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("classRtmpHint")}</p>
        </form>
      </CardContent>
    </Card>
  );
}
