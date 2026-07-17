"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
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
    birth_date: formData.get("birth_date"),
    accept_terms: formData.get("accept_terms"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    username: parsed.data.username,
    full_name: parsed.data.full_name || null,
    bio: parsed.data.bio || null,
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
    return { error: error.message };
  }

  // Append an auditable consent record. This is a legal/compliance log, so a
  // failed insert must not be swallowed — otherwise the user is sent to /feed
  // as if they accepted while no consent record exists. The profile upsert above
  // is idempotent, so returning an error here retries the whole action safely
  // rather than proceeding without the record.
  const { error: consentError } = await supabase.from("consents").insert({
    user_id: user.id,
    terms_version: TERMS_VERSION,
    privacy_version: PRIVACY_VERSION,
  });
  if (consentError) {
    return { error: "Could not record your consent. Please try again." };
  }

  revalidatePath("/", "layout");
  redirect("/feed");
}
