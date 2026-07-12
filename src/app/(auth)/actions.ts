"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { publicEnv } from "@/lib/env";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

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
      emailRedirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback`,
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
      redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback`,
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
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
  });
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
