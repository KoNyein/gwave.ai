"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserMinus } from "lucide-react";
import { useTranslations } from "next-intl";

import { UserAvatar } from "@/components/social/user-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { addStoreMember, removeStoreMember } from "@/lib/actions/pos";
import type { StoreMemberWithProfile } from "@/lib/db/pos";
import { displayName } from "@/lib/format";

export function StaffManager({
  storeId,
  members,
}: {
  storeId: string;
  members: StoreMemberWithProfile[];
}) {
  const t = useTranslations("pos");
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [role, setRole] = React.useState<"staff" | "manager">("staff");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function add() {
    setError(null);
    startTransition(async () => {
      const result = await addStoreMember(storeId, username, role);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setUsername("");
      router.refresh();
    });
  }

  function remove(userId: string) {
    startTransition(async () => {
      await removeStoreMember(storeId, userId);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="px-1 text-xl font-bold">{t("staffTitle")}</h1>

      <Card>
        <CardContent className="space-y-2 p-4">
          <div className="flex flex-wrap gap-2">
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder={t("usernamePlaceholder")}
              className="w-44"
            />
            <select
              value={role}
              onChange={(event) =>
                setRole(event.target.value as "staff" | "manager")
              }
              className="h-10 rounded-md border bg-background px-2 text-sm"
              aria-label={t("role")}
            >
              <option value="staff">{t("roleStaff")}</option>
              <option value="manager">{t("roleManager")}</option>
            </select>
            <Button
              onClick={add}
              disabled={pending || username.trim().length < 3}
            >
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("addMember")}
            </Button>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="divide-y px-4 py-1">
          {members.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("noStaff")}
            </p>
          ) : (
            members.map((member) => (
              <div
                key={member.user_id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="flex items-center gap-3">
                  <UserAvatar profile={member.profile} linked={false} />
                  <div>
                    <p className="text-sm font-semibold">
                      {displayName(member.profile)}
                    </p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {member.role === "manager"
                        ? t("roleManager")
                        : t("roleStaff")}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
                  disabled={pending}
                  onClick={() => remove(member.user_id)}
                  aria-label={t("removeMember")}
                >
                  <UserMinus className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
