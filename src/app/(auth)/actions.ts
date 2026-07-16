"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  AdminConfirmSignUpCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  AdminUserGlobalSignOutCommand,
  ConfirmForgotPasswordCommand,
  ForgotPasswordCommand,
  InitiateAuthCommand,
  SignUpCommand,
  type AuthenticationResultType,
} from "@aws-sdk/client-cognito-identity-provider";
import { z } from "zod";

import { authEnv } from "@/lib/env";
import { cognito, identityFromTokens, secretHash } from "@/lib/auth/cognito";
import { CU_COOKIE, clearSession, readSession, setSession } from "@/lib/auth/session";
import { checkAuthRateLimit } from "@/lib/rate-limit";

/**
 * Auth server actions, backed by AWS Cognito. Cognito verifies credentials and
 * federates Google; on success we read `custom:profile_id` from the id token and
 * mint our own data token (see setSession). The old Supabase auth flow is gone.
 */

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

export type AuthState = { error: string } | null;

/** Turn a Cognito authentication result into a session and stop. */
async function establishSession(result: AuthenticationResultType): Promise<void> {
  const identity = identityFromTokens(result);
  await setSession(identity);
}

function friendlyAuthError(err: unknown): string {
  const name = (err as { name?: string })?.name ?? "";
  switch (name) {
    case "NotAuthorizedException":
      return "Incorrect email or password.";
    case "UserNotFoundException":
      return "Incorrect email or password.";
    case "UserNotConfirmedException":
      return "Please confirm your account first.";
    case "PasswordResetRequiredException":
      return "Please reset your password to continue.";
    case "TooManyRequestsException":
      return "Too many attempts. Please wait a minute.";
    default:
      return (err as { message?: string })?.message ?? "Something went wrong.";
  }
}

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

  const { clientId } = authEnv.cognito;
  try {
    const out = await cognito().send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: clientId,
        AuthParameters: {
          USERNAME: parsed.data.email,
          PASSWORD: parsed.data.password,
          SECRET_HASH: secretHash(parsed.data.email),
        },
      }),
    );
    if (out.ChallengeName || !out.AuthenticationResult) {
      // NEW_PASSWORD_REQUIRED etc. — a migrated user must set a password first.
      return { error: "Please reset your password to continue." };
    }
    await establishSession(out.AuthenticationResult);
  } catch (err) {
    return { error: friendlyAuthError(err) };
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

  const { clientId, userPoolId } = authEnv.cognito;
  const profileId = randomUUID();
  const email = parsed.data.email;

  try {
    await cognito().send(
      new SignUpCommand({
        ClientId: clientId,
        Username: email,
        Password: parsed.data.password,
        SecretHash: secretHash(email),
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "custom:profile_id", Value: profileId },
        ],
      }),
    );
    // Skip the email-code step to preserve the "sign up → onboarding" flow:
    // confirm and mark the email verified server-side, then sign in.
    await cognito().send(
      new AdminConfirmSignUpCommand({ UserPoolId: userPoolId, Username: email }),
    );
    await cognito().send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: userPoolId,
        Username: email,
        UserAttributes: [{ Name: "email_verified", Value: "true" }],
      }),
    );
    const out = await cognito().send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: parsed.data.password,
          SECRET_HASH: secretHash(email),
        },
      }),
    );
    if (!out.AuthenticationResult) {
      return { error: "Could not sign you in after registration." };
    }
    await establishSession(out.AuthenticationResult);
  } catch (err) {
    const name = (err as { name?: string })?.name ?? "";
    if (name === "UsernameExistsException") {
      return { error: "An account with this email already exists." };
    }
    if (name === "InvalidPasswordException") {
      return { error: "Password does not meet the requirements." };
    }
    return { error: friendlyAuthError(err) };
  }

  revalidatePath("/", "layout");
  redirect("/onboarding");
}

/** Cognito's Hosted UI is the Google entry point — build its authorize URL and
 * redirect there. The callback (/auth/callback) exchanges the code. */
export async function signInWithGoogle(formData?: FormData): Promise<void> {
  const requested = String(formData?.get("redirectTo") ?? "");
  const next =
    requested.startsWith("/") && !requested.startsWith("//") ? requested : "/feed";

  const { domain, clientId } = authEnv.cognito;
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://gwave.cc"}/auth/callback`;
  const url = new URL(`${domain}/oauth2/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("identity_provider", "Google");
  url.searchParams.set("state", next);
  redirect(url.toString());
}

export async function logout() {
  await revokeAndClear(false);
  redirect("/login");
}

export async function signOutEverywhere() {
  await revokeAndClear(true);
  redirect("/login");
}

async function revokeAndClear(global: boolean): Promise<void> {
  // "Sign out everywhere" revokes every Cognito refresh token for the user
  // (done with admin creds against the username, since we don't hold the
  // Cognito access token — gw_at is our own data token). A normal logout just
  // drops the cookies; the data token expires on its own.
  if (global) {
    try {
      const cognitoUsername = (await cookies()).get(CU_COOKIE)?.value;
      if (cognitoUsername) {
        await cognito()
          .send(
            new AdminUserGlobalSignOutCommand({
              UserPoolId: authEnv.cognito.userPoolId,
              Username: cognitoUsername,
            }),
          )
          .catch(() => {});
      }
    } catch {
      // ignore — clearing cookies below is what ends the session here
    }
  }
  await clearSession();
  revalidatePath("/", "layout");
}

export type RecoveryState = { error: string } | { ok: true } | null;

/**
 * Account recovery step 1: Cognito emails a verification code. Always reports
 * success so the form can't be used to probe which emails are registered.
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

  try {
    await cognito().send(
      new ForgotPasswordCommand({
        ClientId: authEnv.cognito.clientId,
        Username: parsed.data,
        SecretHash: secretHash(parsed.data),
      }),
    );
  } catch (err) {
    const name = (err as { name?: string })?.name ?? "";
    // Don't leak existence; only surface genuine operational limits.
    if (name === "TooManyRequestsException" || name === "LimitExceededException") {
      return { error: "Too many attempts. Please wait a minute." };
    }
  }
  return { ok: true };
}

/**
 * Account recovery step 2: confirm the emailed code and set a new password.
 * Requires the code from the recovery email (a new field on the reset form).
 */
export async function updatePassword(
  _prevState: RecoveryState,
  formData: FormData,
): Promise<RecoveryState> {
  const email = formData.get("email");
  const code = formData.get("code");
  const password = formData.get("password");
  const confirm = formData.get("confirm");

  const schema = z.object({
    email: z.string().email(),
    code: z.string().min(1, "Enter the code from your email."),
    password: z.string().min(6, "Password must be at least 6 characters."),
  });
  const parsed = schema.safeParse({ email, code, password });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input." };
  }
  if (password !== confirm) {
    return { error: "PASSWORDS_DO_NOT_MATCH" };
  }

  try {
    await cognito().send(
      new ConfirmForgotPasswordCommand({
        ClientId: authEnv.cognito.clientId,
        Username: parsed.data.email,
        ConfirmationCode: parsed.data.code,
        Password: parsed.data.password,
        SecretHash: secretHash(parsed.data.email),
      }),
    );
  } catch (err) {
    const name = (err as { name?: string })?.name ?? "";
    if (name === "CodeMismatchException") return { error: "That code is incorrect." };
    if (name === "ExpiredCodeException") return { error: "That code has expired." };
    return { error: friendlyAuthError(err) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Change the password of the currently signed-in user (Settings → Security).
 * We trust the session, so we set the new password directly with admin creds —
 * no "current password" prompt, matching the previous one-field UX.
 */
export async function changePassword(
  _prevState: RecoveryState,
  formData: FormData,
): Promise<RecoveryState> {
  const session = await readSession();
  if (!session) return { error: "SESSION_EXPIRED" };

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

  const cognitoUsername = (await cookies()).get(CU_COOKIE)?.value;
  if (!cognitoUsername) return { error: "SESSION_EXPIRED" };

  try {
    await cognito().send(
      new AdminSetUserPasswordCommand({
        UserPoolId: authEnv.cognito.userPoolId,
        Username: cognitoUsername,
        Password: parsed.data,
        Permanent: true,
      }),
    );
  } catch (err) {
    const name = (err as { name?: string })?.name ?? "";
    if (name === "InvalidPasswordException") {
      return { error: "Password does not meet the requirements." };
    }
    return { error: friendlyAuthError(err) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
