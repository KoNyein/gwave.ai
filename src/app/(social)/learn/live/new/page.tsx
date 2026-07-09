import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { StartClassForm } from "@/components/learn/start-class-form";
import { getCurrentProfile } from "@/lib/auth";

export const metadata = { title: "Start a class" };
export const dynamic = "force-dynamic";

/** Teacher-only page to start a live class. */
export default async function NewClassPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const canHost =
    profile.is_teacher ||
    ["moderator", "admin", "super_admin"].includes(profile.role);
  if (!canHost) redirect("/learn/teach");

  const t = await getTranslations("learn");

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link
        href="/learn/live"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("liveClasses")}
      </Link>
      <div>
        <h1 className="text-xl font-bold">{t("startClass")}</h1>
        <p className="text-sm text-muted-foreground">{t("startClassSubtitle")}</p>
      </div>
      <StartClassForm />
    </div>
  );
}
