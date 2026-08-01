"use client";

import * as React from "react";
import { Check, ShieldOff, X, RotateCcw } from "lucide-react";

import { mediaRef } from "@/lib/media-url";

export interface DriverApplication {
  user_id: string;
  status: string;
  vehicle_type: string;
  plate_number: string;
  phone: string;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  licence_photo: string | null;
  vehicle_photo: string | null;
  registration_photo: string | null;
  completed_rides: number;
  cancelled_rides: number;
  rating_sum: number;
  rating_count: number;
  review_note: string | null;
  created_at: string;
  account: { name: string | null; avatar: string | null };
}

const VEHICLE_LABEL: Record<string, string> = {
  bike: "မော်တော်ဆိုင်ကယ်",
  three_wheeler: "သုံးဘီး",
  car: "ကား",
  delivery: "ပစ္စည်းပို့",
};

/**
 * One driver application, with the three documents shown full-width enough to
 * actually read.
 *
 * Thumbnails would make this page faster and useless: the entire job is
 * checking that the name on a licence matches the account and that the plate in
 * the photo matches the plate that was typed. A reviewer who has to open each
 * image in a new tab will stop checking by the tenth application.
 *
 * Rejecting requires a reason. A driver told only "not approved" resubmits the
 * same documents and the queue gets the same application back.
 */
export function DriverReviewRow({ app }: { app: DriverApplication }) {
  const [status, setStatus] = React.useState(app.status);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const rating =
    app.rating_count > 0
      ? (app.rating_sum / app.rating_count).toFixed(1)
      : null;

  async function decide(action: "approve" | "reject" | "suspend" | "reinstate") {
    if ((action === "reject" || action === "suspend") && !note.trim()) {
      setError("Say why — the driver sees this, and a reason is what stops the same application coming back.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ride/admin/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: app.user_id,
          action,
          note: note.trim() || undefined,
        }),
      });
      const body = (await res.json()) as { status?: string; error?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not update this driver.");
        return;
      }
      setStatus(body.status ?? status);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const docs = [
    { label: "Driving licence", key: app.licence_photo },
    { label: "Vehicle", key: app.vehicle_photo },
    { label: "Registration", key: app.registration_photo },
  ];
  const missing = docs.filter((d) => !d.key).map((d) => d.label);

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-start gap-3 p-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">
              {app.account.name ?? "Unnamed account"}
            </span>
            <span className="rounded bg-muted px-2 py-0.5 font-mono text-sm font-bold tracking-wider">
              {app.plate_number}
            </span>
            <StatusPill status={status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {VEHICLE_LABEL[app.vehicle_type] ?? app.vehicle_type}
            {" · "}
            {[app.vehicle_color, app.vehicle_make, app.vehicle_model]
              .filter(Boolean)
              .join(" ") || "no vehicle details"}
            {" · "}
            <a className="underline" href={`tel:${app.phone}`}>
              {app.phone}
            </a>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Applied {new Date(app.created_at).toLocaleDateString()}
            {app.completed_rides > 0
              ? ` · ${app.completed_rides} trips · ${app.cancelled_rides} cancelled`
              : ""}
            {rating ? ` · ★ ${rating}` : ""}
          </p>
          {app.review_note ? (
            <p className="mt-1 text-xs text-amber-600">
              Previous note: {app.review_note}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 px-3 sm:grid-cols-3">
        {docs.map((d) => {
          const url = d.key ? mediaRef(d.key) : null;
          return (
            <figure key={d.label} className="space-y-1">
              <figcaption className="text-xs font-medium text-muted-foreground">
                {d.label}
              </figcaption>
              {url ? (
                <a href={url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={d.label}
                    className="h-40 w-full rounded-lg border object-cover"
                  />
                </a>
              ) : (
                <div className="flex h-40 w-full items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                  Not uploaded
                </div>
              )}
            </figure>
          );
        })}
      </div>

      {missing.length > 0 ? (
        <p className="mx-3 mt-2 rounded-md bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-400">
          Cannot approve — missing: {missing.join(", ")}.
        </p>
      ) : null}

      {error ? (
        <p className="mx-3 mt-2 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 p-3">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reason (shown to the driver)"
          maxLength={300}
          className="min-w-0 flex-1 rounded-md border bg-background px-2.5 py-1.5 text-sm"
        />
        {status === "approved" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => decide("suspend")}
            className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground disabled:opacity-50"
          >
            <ShieldOff className="h-4 w-4" />
            Suspend
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={busy || missing.length > 0}
              onClick={() => decide(status === "suspended" ? "reinstate" : "approve")}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {status === "suspended" ? (
                <RotateCcw className="h-4 w-4" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {status === "suspended" ? "Reinstate" : "Approve"}
            </button>
            {status !== "rejected" && status !== "suspended" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => decide("reject")}
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Reject
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const style =
    {
      approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
      pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
      rejected: "bg-muted text-muted-foreground",
      suspended: "bg-destructive/15 text-destructive",
    }[status] ?? "bg-muted text-muted-foreground";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${style}`}>
      {status}
    </span>
  );
}
