"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { publicEnv } from "@/lib/env";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

/**
 * The site origin as seen by the current request. Auth emails and OAuth
 * redirects must point at the real deployed host — deriving it from the
 * request means they work even when NEXT_PUBLIC_SITE_URL is unset (its
 * localhost default would otherwise end up inside recovery emails).
 */
async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? "https";
    return `${proto}://${host}`;
  }
  return publicEnv.NEXT_PUBLIC_SITE_URL;
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

export type AuthState = { error: string } | null;

export async function login(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }
  if (!(await checkAuthRateLimit("login", 10))) {
    return { error: "Too many attempts. Please wait a minute." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: error.message };
  }

  const redirectTo = (formData.get("redirectTo") as string) || "/feed";
  revalidatePath("/", "layout");
  redirect(redirectTo);
}

export async function register(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }
  if (!(await checkAuthRateLimit("register", 5))) {
    return { error: "Too many attempts. Please wait a minute." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    ...parsed.data,
    options: {
      emailRedirectTo: `${await siteOrigin()}/auth/callback`,
    },
  });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/onboarding");
}

export async function signInWithGoogle(): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await siteOrigin()}/auth/callback`,
    },
  });
  if (error) {
    redirect("/login?error=oauth");
  }
  if (data.url) {
    redirect(data.url);
  }
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export type RecoveryState = { error: string } | { ok: true } | null;

/**
 * Account recovery step 1: email the user a password-reset link. The link
 * lands on /auth/callback which exchanges the code for a session and then
 * forwards to /reset-password. Always reports success so the form can't be
 * used to probe which emails are registered.
 */
export async function requestPasswordReset(
  _prevState: RecoveryState,
  formData: FormData,
): Promise<RecoveryState> {
  const parsed = z.string().email().safeParse(formData.get("email"));
  if (!parsed.success) {
    return { error: "Invalid email address." };
  }
  if (!(await checkAuthRateLimit("recover", 5))) {
    return { error: "Too many attempts. Please wait a minute." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/reset-password`,
  });
  // Operational failures (SMTP not configured, provider rate limit) must be
  // visible — silently claiming success would strand the user. Supabase does
  // not reveal whether the email exists, so this leaks nothing.
  if (error) {
    return { error: error.message };
  }
  return { ok: true };
}

/**
 * Account recovery step 2 (also used by Settings → Security): set a new
 * password on the current session — either the recovery session created by
 * the emailed link, or a normal logged-in session.
 */
export async function updatePassword(
  _prevState: RecoveryState,
  formData: FormData,
): Promise<RecoveryState> {
  const password = formData.get("password");
  const confirm = formData.get("confirm");
  const parsed = z
    .string()
    .min(6, "Password must be at least 6 characters.")
    .safeParse(password);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid password." };
  }
  if (password !== confirm) {
    return { error: "PASSWORDS_DO_NOT_MATCH" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "SESSION_EXPIRED" };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
