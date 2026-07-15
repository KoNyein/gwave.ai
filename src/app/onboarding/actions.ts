"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/consent";
import { createClient } from "@/lib/supabase/server";

const profileSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters.")
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers and underscores only."),
  full_name: z.string().max(80).optional().or(z.literal("")),
  bio: z.string().max(280).optional().or(z.literal("")),
  avatar_url: z.string().url().optional().or(z.literal("")),
  birth_date: z
    .string()
    .min(1, "Please enter your date of birth.")
    .refine((value) => {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return false;
      const now = new Date();
      const min = new Date("1900-01-01");
      return d > min && d <= now;
    }, "Please enter a valid date of birth."),
  accept_terms: z
    .string()
    .refine((v) => v === "on", "You must accept the Terms and Privacy Policy."),
  // IANA timezone (e.g. "Asia/Yangon") — a privacy-friendly region signal.
  timezone: z.string().max(60).optional().or(z.literal("")),
});

export type OnboardingState = { error: string } | null;

export async function saveProfile(
  _prevState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const parsed = profileSchema.safeParse({
    username: formData.get("username"),
    full_name: formData.get("full_name"),
    bio: formData.get("bio"),
    avatar_url: formData.get("avatar_url"),
    birth_date: formData.get("birth_date"),
    accept_terms: formData.get("accept_terms"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    username: parsed.data.username,
    full_name: parsed.data.full_name || null,
    bio: parsed.data.bio || null,
    avatar_url: parsed.data.avatar_url || null,
    birth_date: parsed.data.birth_date,
    timezone: parsed.data.timezone || null,
    terms_accepted_version: TERMS_VERSION,
    privacy_accepted_version: PRIVACY_VERSION,
    terms_accepted_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "That username is already taken." };
    }
    // 23503 = foreign_key_violation on profiles_id_fkey: the signed-in session
    // points at an auth user that no longer exists in the database (e.g. the
    // auth users were reset, or the app is pointed at a different Supabase
    // project than the one that issued this session). The session is unusable,
    // so clear it and send the user back to log in fresh rather than showing a
    // raw database error they can't act on.
    if (error.code === "23503") {
      await supabase.auth.signOut();
      redirect("/login?error=session_stale");
    }
    // 42703 = undefined_column: a pending migration hasn't been applied to this
    // database. Surface an operator-actionable hint instead of the raw error.
    if (error.code === "42703") {
      return {
        error:
          "The server database is missing a recent update. Please ask the admin to apply pending migrations, then try again.",
      };
    }
    return { error: error.message };
  }

  // Append an auditable consent record.
  await supabase.from("consents").insert({
    user_id: user.id,
    terms_version: TERMS_VERSION,
    privacy_version: PRIVACY_VERSION,
  });

  revalidatePath("/", "layout");
  redirect("/feed");
}
