"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveGpayKyc } from "@/lib/actions/gpay";
import type { GpayAccount } from "@/types/database";

/**
 * KYC registration / edit form. Collects the details G-Pay requires before an
 * account may be used: legal name, NRC, KPay number, email, at least one
 * messenger contact and an address. Submitting a complete form creates a
 * pending account (or updates an existing one's details).
 */
export function GpayRegistrationForm({
  account,
}: {
  account: GpayAccount | null;
}) {
  const t = useTranslations("gpay");
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    // These keys match the input `name` attributes rendered by field() below,
    // which use the snake_case column names.
    const res = await saveGpayKyc({
      fullName: String(fd.get("full_name") ?? ""),
      nrcNumber: String(fd.get("nrc_number") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      email: String(fd.get("email") ?? ""),
      telegram: String(fd.get("telegram") ?? ""),
      viber: String(fd.get("viber") ?? ""),
      address: String(fd.get("address") ?? ""),
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  const field = (
    name: keyof GpayAccount,
    label: string,
    opts?: { type?: string; required?: boolean; placeholder?: string },
  ) => (
    <div className="space-y-1">
      <Label htmlFor={name}>
        {label}
        {opts?.required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Input
        id={name}
        name={name}
        type={opts?.type ?? "text"}
        required={opts?.required}
        placeholder={opts?.placeholder}
        defaultValue={(account?.[name] as string | null) ?? ""}
      />
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="text-xs text-muted-foreground">{t("kycNote")}</p>
      </div>

      {field("full_name", t("fullName"), { required: true })}
      {field("nrc_number", t("nrc"), {
        required: true,
        placeholder: "12/ABCDEF(N)123456",
      })}
      {field("phone", t("kpayNo"), { required: true, placeholder: "09xxxxxxxxx" })}
      {field("email", t("email"), { type: "email", required: true })}

      <div className="grid gap-3 sm:grid-cols-2">
        {field("telegram", t("telegram"), { placeholder: "@username" })}
        {field("viber", t("viber"), { placeholder: "09xxxxxxxxx" })}
      </div>
      <p className="text-xs text-muted-foreground">{t("contactHint")}</p>

      {field("address", t("address"), { required: true })}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
        {account ? t("updateDetails") : t("submitKyc")}
      </Button>
    </form>
  );
}
