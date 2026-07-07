"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ShieldOff } from "lucide-react";
import { useTranslations } from "next-intl";

import { UserAvatar } from "@/components/social/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setUserRole, suspendUser, unsuspendUser } from "@/lib/actions/admin";
import { displayName, timeAgo } from "@/lib/format";
import type { Profile, UserRole } from "@/types/database";

const ROLES: UserRole[] = ["user", "member", "moderator", "developer", "admin"];

export function AdminUserRow({
  user,
  isSelf,
}: {
  user: Profile;
  isSelf: boolean;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [suspending, setSuspending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const suspended =
    user.suspended_until !== null &&
    new Date(user.suspended_until) > new Date();
  const locked = isSelf || user.role === "super_admin";

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "Failed.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <Link
        href={user.username ? `/u/${user.username}` : "#"}
        className="flex min-w-0 items-center gap-3"
      >
        <UserAvatar profile={user} linked={false} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{displayName(user)}</p>
          <p className="truncate text-xs text-muted-foreground">
            @{user.username ?? "—"} · {t("joined")} {timeAgo(user.created_at)}
            {suspended
              ? ` · ${t("suspendedUntil", {
                  date: new Date(user.suspended_until!).toLocaleDateString(),
                })}`
              : ""}
          </p>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
      </Link>

      <div className="flex shrink-0 items-center gap-2">
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <>
            <select
              value={user.role}
              disabled={locked}
              onChange={(event) =>
                run(() => setUserRole(user.id, event.target.value as UserRole))
              }
              className="h-8 rounded-md border bg-background px-2 text-xs capitalize disabled:opacity-50"
              aria-label={t("role")}
            >
              {user.role === "super_admin" ? (
                <option value="super_admin">super admin</option>
              ) : null}
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role.replace("_", " ")}
                </option>
              ))}
            </select>
            {suspended ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => run(() => unsuspendUser(user.id))}
              >
                {t("unsuspend")}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={locked || user.role === "admin"}
                className="text-destructive hover:text-destructive"
                onClick={() => setSuspending(true)}
              >
                <ShieldOff className="mr-1 h-4 w-4" />
                {t("suspend")}
              </Button>
            )}
          </>
        )}
      </div>

      {suspending ? (
        <SuspendDialog
          userId={user.id}
          name={displayName(user)}
          onClose={() => {
            setSuspending(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function SuspendDialog({
  userId,
  name,
  onClose,
}: {
  userId: string;
  name: string;
  onClose: () => void;
}) {
  const t = useTranslations("admin");
  const [days, setDays] = React.useState(7);
  const [reason, setReason] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function submit() {
    startTransition(async () => {
      const result = await suspendUser(userId, days, reason);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("suspendTitle", { name })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="suspend-days">{t("duration")}</Label>
            <select
              id="suspend-days"
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              className="h-10 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value={1}>{t("days", { count: 1 })}</option>
              <option value={7}>{t("days", { count: 7 })}</option>
              <option value={30}>{t("days", { count: 30 })}</option>
              <option value={365}>{t("days", { count: 365 })}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="suspend-reason">{t("reason")}</Label>
            <Input
              id="suspend-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={300}
              placeholder={t("reasonPlaceholder")}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            className="w-full"
            onClick={submit}
            disabled={pending || reason.trim().length < 3}
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("suspend")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
