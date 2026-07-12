"use client";

import * as React from "react";
import Link from "next/link";
import {
  BadgeCheck,
  ChevronDown,
  KeyRound,
  LogOut,
  Mail,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { signOutEverywhere } from "@/app/(auth)/actions";
import { UpdatePasswordForm } from "@/components/auth/password-reset";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Settings → Account security. A single, easy-to-scan panel that shows the
 * member their account status and gives them the few controls that actually
 * protect an account: change the password, recover access, and sign out of all
 * other devices. Copy is Burmese-first to match the rest of Settings.
 */
export function AccountSecurity({
  email,
  emailVerified,
  lastSignInAt,
}: {
  email: string;
  emailVerified: boolean;
  lastSignInAt: string | null;
}) {
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <div className="space-y-4">
      {/* Account status at a glance */}
      <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
        <Row
          icon={<Mail className="h-4 w-4" />}
          label="အီးမေးလ်"
          value={email}
        />
        <Row
          icon={
            emailVerified ? (
              <BadgeCheck className="h-4 w-4 text-primary" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-amber-600" />
            )
          }
          label="အီးမေးလ် အတည်ပြုမှု"
          value={
            <span
              className={cn(
                "font-medium",
                emailVerified ? "text-primary" : "text-amber-600",
              )}
            >
              {emailVerified ? "အတည်ပြုပြီး ✓" : "မအတည်ပြုရသေး"}
            </span>
          }
        />
        {lastSignInAt ? (
          <Row
            icon={<ShieldCheck className="h-4 w-4" />}
            label="နောက်ဆုံး ဝင်ရောက်ချိန်"
            value={new Date(lastSignInAt).toLocaleString()}
          />
        ) : null}
      </div>

      {/* Change password (collapsible) */}
      <div className="rounded-lg border">
        <button
          type="button"
          onClick={() => setShowPassword((s) => !s)}
          className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm font-medium hover:bg-muted"
        >
          <span className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            စကားဝှက် ပြောင်းရန်
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              showPassword && "rotate-180",
            )}
          />
        </button>
        {showPassword ? (
          <div className="border-t p-3">
            <p className="mb-3 text-xs text-muted-foreground">
              အနည်းဆုံး ၆ လုံး — စာလုံး၊ ဂဏန်း၊ သင်္ကေတ ရောစပ်ထားရင် ပိုလုံခြုံ
              ပါတယ်။
            </p>
            <UpdatePasswordForm compact />
          </div>
        ) : null}
      </div>

      {/* Recovery link */}
      <Link
        href="/forgot-password"
        className="flex items-center gap-2 rounded-lg border p-3 text-sm font-medium hover:bg-muted"
      >
        <Mail className="h-4 w-4 text-primary" />
        စကားဝှက် မေ့နေပါသလား — Recovery link ပို့ရန်
      </Link>

      {/* Sign out of every device */}
      <form action={signOutEverywhere}>
        <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-destructive">
            <LogOut className="h-4 w-4" />
            စက် အားလုံးမှ ထွက်ရန် (Sign out everywhere)
          </p>
          <p className="text-xs text-muted-foreground">
            သင့်အကောင့်ကို တခြားစက်/browser များတွင် ဝင်ထားသေးရင် အားလုံးကို
            ချက်ချင်း ထွက်စေပါမည်။ အကောင့် အန္တရာယ်ရှိမည် ထင်ရင် သုံးပါ။
          </p>
          <Button type="submit" variant="destructive" size="sm">
            <LogOut className="mr-1.5 h-4 w-4" />
            အားလုံးမှ ထွက်မည်
          </Button>
        </div>
      </form>

      {/* Safety tips */}
      <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
        <p className="mb-1 font-medium text-foreground">🔒 လုံခြုံရေး အကြံပြုချက်</p>
        <ul className="list-inside list-disc space-y-0.5">
          <li>စကားဝှက်ကို တခြား site များနှင့် မတူအောင် ထားပါ။</li>
          <li>သင့် စကားဝှက်/OTP ကို မည်သူ့ကိုမျှ ဘယ်တော့မှ မပေးပါနှင့်။</li>
          <li>အများသုံး စက်တွင် ဝင်ပြီးရင် “အားလုံးမှ ထွက်” ကို နှိပ်ပါ။</li>
        </ul>
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="min-w-0 truncate text-right">{value}</span>
    </div>
  );
}
