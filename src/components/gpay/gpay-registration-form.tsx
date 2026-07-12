"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, Upload, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";

import { FaceCapture } from "@/components/gpay/face-capture";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveGpayKyc } from "@/lib/actions/gpay";
import {
  GPAY_PLATFORM_KPAY,
  GPAY_REGISTER_FEE_MMK,
} from "@/lib/gpay";
import { prepareMedia } from "@/lib/media";
import { createClient } from "@/lib/supabase/client";
import type { GpayAccount } from "@/types/database";

/**
 * KYC registration / edit form. Collects the details G-Pay requires before an
 * account may be used: legal name, NRC, KPay number, email, at least one
 * messenger contact and an address. Submitting a complete form creates a
 * pending account (or updates an existing one's details).
 */
export function GpayRegistrationForm({
  account,
  userId,
}: {
  account: GpayAccount | null;
  userId: string;
}) {
  const t = useTranslations("gpay");
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [slip, setSlip] = React.useState<File | null>(null);
  const slipInputRef = React.useRef<HTMLInputElement>(null);
  // KYC face scan: required for a first registration, optional (replace) on edit.
  const [face, setFace] = React.useState<File | null>(null);
  const hasExistingFace = Boolean(account?.face_path);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // A face scan must be captured before the account can be submitted.
    if (!face && !hasExistingFace) {
      setError(t("faceRequired"));
      return;
    }

    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const supabase = createClient();

    // Upload a newly chosen payment slip + face scan to the private "slips"
    // bucket first; we store only their paths. Editing without a new capture
    // keeps the old one.
    let slipPath = "";
    let facePath = "";
    try {
      if (slip) {
        const prepared = await prepareMedia(slip);
        if (prepared.mediaType !== "image") throw new Error(t("slipImageOnly"));
        slipPath = `${userId}/gpay/${crypto.randomUUID()}.${prepared.extension}`;
        const { error: upErr } = await supabase.storage
          .from("slips")
          .upload(slipPath, prepared.blob, {
            contentType: prepared.contentType,
          });
        if (upErr) throw new Error(upErr.message);
      }
      if (face) {
        facePath = `${userId}/gpay/face-${crypto.randomUUID()}.jpg`;
        const { error: faceErr } = await supabase.storage
          .from("slips")
          .upload(facePath, face, { contentType: "image/jpeg" });
        if (faceErr) throw new Error(faceErr.message);
      }
    } catch (err) {
      setPending(false);
      setError(err instanceof Error ? err.message : t("slipUploadFailed"));
      return;
    }

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
      slipPath,
      facePath,
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSlip(null);
    setFace(null);
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

      {/* KYC face scan — required before the account can be submitted */}
      <FaceCapture onCapture={setFace} hasExisting={hasExistingFace} />

      {/* Deposit instruction + payment-slip upload */}
      <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Wallet className="h-4 w-4 text-primary" /> {t("depositTitle")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("depositHint", {
            amount: GPAY_REGISTER_FEE_MMK.toLocaleString(),
          })}
          {GPAY_PLATFORM_KPAY ? (
            <>
              {" "}
              <span className="font-mono font-medium text-foreground">
                {GPAY_PLATFORM_KPAY}
              </span>
            </>
          ) : null}
        </p>
        <button
          type="button"
          onClick={() => slipInputRef.current?.click()}
          className="flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed p-4 text-xs text-muted-foreground transition-colors hover:bg-muted"
        >
          <Upload className="h-5 w-5" />
          {slip
            ? slip.name
            : account?.slip_path
              ? t("slipReplace")
              : t("slipChoose")}
        </button>
        <input
          ref={slipInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(ev) => {
            setSlip(ev.target.files?.[0] ?? null);
            ev.target.value = "";
          }}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
        {account ? t("updateDetails") : t("submitKyc")}
      </Button>
    </form>
  );
}
