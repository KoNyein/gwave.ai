"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

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

/**
 * Google's own nonce contract: the ID token carries a SHA-256 hash of the
 * nonce, and Supabase re-hashes the raw one we hand it to check they match. So
 * Google gets the hash and Supabase gets the original — sending the same value
 * to both fails validation.
 */
async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes));
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw),
  );
  const hashed = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { raw, hashed };
}

/**
 * Google One Tap: a returning user who is signed in to Google is offered their
 * account and lands in the app in one tap — no password, no redirect round-trip
 * through Google's consent screen.
 *
 * This is additive. Without NEXT_PUBLIC_GOOGLE_CLIENT_ID (or if the browser
 * blocks third-party prompts, or the user has dismissed it too often) nothing
 * renders and the ordinary "Continue with Google" button still works.
 */
export function GoogleOneTap({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const clientId = publicEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  React.useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    async function initialise() {
      const supabase = createClient();
      // Already signed in (e.g. a second tab) — don't prompt.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session || cancelled) return;

      const { raw, hashed } = await makeNonce();
      if (cancelled) return;

      window.google?.accounts.id.initialize({
        client_id: clientId,
        nonce: hashed,
        // Sign a returning user straight in, which is the whole point.
        auto_select: true,
        // FedCM is the only path that still works now Chrome has dropped
        // third-party cookies; without it the prompt silently never shows.
        use_fedcm_for_prompt: true,
        callback: async (response: CredentialResponse) => {
          const { error } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token: response.credential,
            nonce: raw,
          });
          if (error) return;

          // A brand-new Google user has no username yet — the rest of the app
          // gates on that, so send them to onboarding rather than into a feed
          // that would just bounce them back.
          const {
            data: { user },
          } = await supabase.auth.getUser();
          const { data: profile } = user
            ? await supabase
                .from("profiles")
                .select("username")
                .eq("id", user.id)
                .maybeSingle()
            : { data: null };

          router.push(profile?.username ? redirectTo : "/onboarding");
          router.refresh();
        },
      });
      window.google?.accounts.id.prompt();
    }

    if (window.google?.accounts?.id) {
      void initialise();
    } else {
      const script = document.createElement("script");
      script.src = GSI_SRC;
      script.async = true;
      script.onload = () => void initialise();
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      window.google?.accounts.id.cancel();
    };
  }, [clientId, redirectTo, router]);

  // One Tap paints its own prompt, anchored by the browser — nothing to render.
  return null;
}
