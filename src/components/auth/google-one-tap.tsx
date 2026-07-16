"use client";

import * as React from "react";

import { publicEnv } from "@/lib/env";

interface CredentialResponse {
  credential: string;
}

interface GoogleAccountsId {
  initialize: (config: Record<string, unknown>) => void;
  prompt: () => void;
  cancel: () => void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

const GSI_SRC = "https://accounts.google.com/gsi/client";

/** The email inside a Google ID token, used only as a login hint. */
function emailFromCredential(credential: string): string | null {
  try {
    const payload = credential.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    );
    return typeof json.email === "string" ? json.email : null;
  } catch {
    return null;
  }
}

/**
 * Google One Tap for the Cognito auth stack.
 *
 * Cognito User Pools federate Google through the Hosted UI OAuth redirect, not by
 * consuming a raw Google ID token — so One Tap can't sign the user in directly.
 * Instead we use One Tap purely as the prompt: when the user picks an account we
 * redirect straight into Cognito's Google authorize endpoint with that account as
 * a login hint. Because the user just authenticated with Google, that round-trip
 * completes without a second Google screen and lands back at /auth/callback.
 *
 * Renders nothing without the Google client id or the Cognito domain/client id.
 */
export function GoogleOneTap({ redirectTo }: { redirectTo: string }) {
  const clientId = publicEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const cognitoDomain = publicEnv.NEXT_PUBLIC_COGNITO_DOMAIN;
  const cognitoClientId = publicEnv.NEXT_PUBLIC_COGNITO_CLIENT_ID;

  React.useEffect(() => {
    if (!clientId || !cognitoDomain || !cognitoClientId) return;
    let cancelled = false;

    function toCognito(loginHint: string | null) {
      const url = new URL(`${cognitoDomain}/oauth2/authorize`);
      url.searchParams.set("client_id", cognitoClientId!);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", "openid email profile");
      url.searchParams.set(
        "redirect_uri",
        `${window.location.origin}/auth/callback`,
      );
      url.searchParams.set("identity_provider", "Google");
      const next =
        redirectTo.startsWith("/") && !redirectTo.startsWith("//")
          ? redirectTo
          : "/feed";
      url.searchParams.set("state", next);
      if (loginHint) url.searchParams.set("login_hint", loginHint);
      window.location.href = url.toString();
    }

    function initialise() {
      if (cancelled) return;
      window.google?.accounts.id.initialize({
        client_id: clientId,
        auto_select: true,
        use_fedcm_for_prompt: true,
        callback: (response: CredentialResponse) => {
          toCognito(emailFromCredential(response.credential));
        },
      });
      window.google?.accounts.id.prompt();
    }

    if (window.google?.accounts?.id) {
      initialise();
    } else {
      const script = document.createElement("script");
      script.src = GSI_SRC;
      script.async = true;
      script.onload = initialise;
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      window.google?.accounts.id.cancel();
    };
  }, [clientId, cognitoDomain, cognitoClientId, redirectTo]);

  return null;
}
