"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  approvePayment,
  extendMembership,
  grantMembership,
  rejectPayment,
  revokeMembership,
} from "@/lib/actions/membership";

export function ReviewActions({ paymentId }: { paymentId: string }) {
  const t = useTranslations("membershipAdmin");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  if (pending) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }
  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={() => run(() => approvePayment(paymentId))}>
        <Check className="mr-1 h-4 w-4" />
        {t("approve")}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => run(() => rejectPayment(paymentId))}
      >
        <X className="mr-1 h-4 w-4" />
        {t("reject")}
      </Button>
    </div>
  );
}

export function MemberActions({
  subscriptionId,
}: {
  subscriptionId: string;
}) {
  const t = useTranslations("membershipAdmin");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            t("manage")
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() => run(() => extendMembership(subscriptionId, 30))}
        >
          {t("extend30")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => run(() => extendMembership(subscriptionId, 365))}
        >
          {t("extend365")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => run(() => revokeMembership(subscriptionId))}
        >
          {t("revoke")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function GrantForm() {
  const t = useTranslations("membershipAdmin");
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [plan, setPlan] = React.useState<"pro" | "business">("pro");
  const [days, setDays] = React.useState(30);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await grantMembership({ username, plan, days });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setUsername("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder={t("usernamePlaceholder")}
          className="w-40"
        />
        <select
          value={plan}
          onChange={(event) =>
            setPlan(event.target.value as "pro" | "business")
          }
          className="rounded-md border bg-background px-3 text-sm"
          aria-label={t("plan")}
        >
          <option value="pro">Pro</option>
          <option value="business">Business</option>
        </select>
        <select
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
          className="rounded-md border bg-background px-3 text-sm"
          aria-label={t("duration")}
        >
          <option value={30}>{t("days30")}</option>
          <option value={90}>{t("days90")}</option>
          <option value={365}>{t("days365")}</option>
        </select>
        <Button
          onClick={submit}
          disabled={pending || username.trim().length < 3}
        >
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t("grant")}
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
