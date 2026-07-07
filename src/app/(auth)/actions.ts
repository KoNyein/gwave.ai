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
