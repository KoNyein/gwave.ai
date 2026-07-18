import { getTranslations } from "next-intl/server";

import { AdminUserRow } from "@/components/admin/user-row";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getCurrentProfile } from "@/lib/auth";
import { getUsers } from "@/lib/db/admin";

export default async function AdminUsersPage(
  props: {
    searchParams: Promise<{ q?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const t = await getTranslations("admin");
  const [viewer, users] = await Promise.all([
    getCurrentProfile(),
    getUsers(searchParams.q),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <h1 className="text-xl font-bold">{t("usersTitle")}</h1>
        <form action="/admin/users">
          <Input
            type="search"
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder={t("searchUsers")}
            className="w-56 bg-background"
          />
        </form>
      </div>

      <Card>
        <CardContent className="divide-y px-4 py-1">
          {users.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("noUsers")}
            </p>
          ) : (
            users.map((user) => (
              <AdminUserRow
                key={user.id}
                user={user}
                isSelf={user.id === viewer?.id}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
