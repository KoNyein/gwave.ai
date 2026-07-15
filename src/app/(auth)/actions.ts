"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { authorizeUrl, logoutUrl } from "@/lib/cognito";
import {
  clearCognitoSession,
  startOAuthState,
} from "@/lib/cognito-session";
import { isCognitoEnabled, publicEnv } from "@/lib/env";
import { checkAuthRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

/**
 * Send the browser to Cognito's Hosted UI to sign in. `idpHint` pre-selects an
 * identity provider (Google), otherwise the Hosted UI shows email/password. The
 * post-login destination rides in the OAuth `state` (CSRF-protected).
 */
async function redirectToCognito(
  next: string,
  idpHint?: "Google",
): Promise<never> {
  const redirectUri = `${await siteOrigin()}/auth/callback`;
  const state = await startOAuthState(next);
  redirect(authorizeUrl({ redirectUri, state, idpHint }));
}

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
  // Cognito owns the login screen (Hosted UI): send the user there. The
  // email/password form on our page is unused in this mode.
  if (isCognitoEnabled()) {
    const requested = String(formData.get("redirectTo") ?? "");
    const next =
      requested.startsWith("/") && !requested.startsWith("//")
        ? requested
        : "/feed";
    await redirectToCognito(next);
  }

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
  // Cognito owns sign-up too (Hosted UI has a "Sign up" link).
  if (isCognitoEnabled()) {
    await redirectToCognito("/onboarding");
  }

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

export async function signInWithGoogle(formData?: FormData): Promise<void> {
  // Carry the page the user was heading for through Google and back. Without
  // this, someone deep-linked to /login?redirectTo=… who signs in with Google
  // always lands on the feed instead of where they were going. Only a relative
  // path is accepted, so the round-trip can't be turned into an open redirect.
  const requested = String(formData?.get("redirectTo") ?? "");
  const next =
    requested.startsWith("/") && !requested.startsWith("//") ? requested : "/feed";

  // Cognito federates Google — jump straight to Google via the Hosted UI.
  if (isCognitoEnabled()) {
    await redirectToCognito(next, "Google");
  }

  const supabase = await createClient();

  const callback = new URL(`${await siteOrigin()}/auth/callback`);
  callback.searchParams.set("next", next);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callback.toString(),
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
  if (isCognitoEnabled()) {
    await clearCognitoSession();
    revalidatePath("/", "layout");
    // End the Cognito Hosted UI session too, then return to /login.
    redirect(logoutUrl(`${await siteOrigin()}/login`));
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

/**
 * Security: sign out of *every* device by revoking all of the user's refresh
 * tokens (global scope). Use after a suspected compromise or a password change
 * to lock out any other active session.
 */
export async function signOutEverywhere() {
  if (isCognitoEnabled()) {
    // Clearing our cookies + ending the Hosted UI session is the reachable
    // equivalent; global Cognito token revocation would need an admin call.
    await clearCognitoSession();
    revalidatePath("/", "layout");
    redirect(logoutUrl(`${await siteOrigin()}/login`));
  }
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
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
