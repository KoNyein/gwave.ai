"use client";

import * as React from "react";
import { CheckCircle2, Download, Loader2, RefreshCw, Rocket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { APP_BUILD_DATE, APP_VERSION } from "@/lib/version";

type State = "idle" | "checking" | "uptodate" | "ready" | "error";

/**
 * Settings → Software update. Lets a member pull the newest build of the app.
 *
 * gwave is a web/PWA/TWA whose HTML + JS are always served fresh by the server,
 * so "update" means: ask the service worker to fetch a new version, clear any
 * stale caches, and reload. The button drives that flow and reports whether a
 * newer version was found.
 */
export function AppUpdate() {
  const [state, setState] = React.useState<State>("idle");

  async function reloadFresh() {
    // Drop any Cache Storage entries so the reload can't be served stale.
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // Non-fatal — a plain reload still fetches the newest server build.
    }
    window.location.reload();
  }

  async function check() {
    setState("checking");
    try {
      if (!("serviceWorker" in navigator)) {
        // No SW (e.g. plain browser tab): a reload already gets the latest.
        await reloadFresh();
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        await reloadFresh();
        return;
      }

      // Ask the browser to re-fetch sw.js; if the byte content changed a new
      // worker installs and we treat that as "update available".
      await reg.update();

      const incoming = reg.installing || reg.waiting;
      if (incoming) {
        setState("ready");
        return;
      }

      // Give a just-triggered install a moment to appear.
      await new Promise((r) => setTimeout(r, 1200));
      if (reg.installing || reg.waiting) {
        setState("ready");
      } else {
        setState("uptodate");
      }
    } catch {
      setState("error");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3">
        <div className="flex items-center gap-2 text-sm">
          <Rocket className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">လက်ရှိ ဗားရှင်း</span>
        </div>
        <span className="font-mono text-sm font-semibold">
          v{APP_VERSION}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {APP_BUILD_DATE}
          </span>
        </span>
      </div>

      {state === "uptodate" ? (
        <p className="flex items-center gap-1.5 text-sm text-primary">
          <CheckCircle2 className="h-4 w-4" />
          နောက်ဆုံး ဗားရှင်း သုံးနေပါပြီ — update မလိုပါ။
        </p>
      ) : null}
      {state === "error" ? (
        <p className="text-sm text-destructive">
          စစ်ဆေး၍ မရပါ။ အင်တာနက် ချိတ်ဆက်မှု စစ်ပြီး ထပ်ကြိုးစားပါ။
        </p>
      ) : null}
      {state === "ready" ? (
        <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
            <Download className="h-4 w-4" />
            Update အသစ် ရှိပါသည်!
          </p>
          <p className="text-xs text-muted-foreground">
            အသစ်ကို သုံးရန် app ကို reload လုပ်ပါ။
          </p>
          <Button size="sm" onClick={reloadFresh}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Reload ၍ update လုပ်မည်
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={check}
          disabled={state === "checking"}
        >
          {state === "checking" ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-1.5 h-4 w-4" />
          )}
          Update များ စစ်ရန်
        </Button>
        <Button variant="ghost" size="sm" onClick={reloadFresh}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          App ကို Refresh
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        gwave သည် web/PWA app ဖြစ်၍ reload လုပ်တိုင်း server မှ နောက်ဆုံး ဗားရှင်းကို
        အလိုအလျောက် ရယူပါသည်။ Play Store app (TWA) အတွက် အဓိက update များကို Play
        Store မှ လည်း ရနိုင်ပါသည်။
      </p>
    </div>
  );
}
