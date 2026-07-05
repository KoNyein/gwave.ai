import { getTranslations } from "next-intl/server";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";

export default async function FeedPage() {
  const t = await getTranslations("feed");
  const profile = await getCurrentProfile();
  const initials = (profile?.username ?? "U").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <Avatar className="h-10 w-10">
            {profile?.avatar_url ? (
              <AvatarImage src={profile.avatar_url} alt="" />
            ) : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <button
            type="button"
            className="flex-1 rounded-full bg-muted px-4 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary"
          >
            {t("createPost")}
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          {t("empty")}
        </CardContent>
      </Card>
    </div>
  );
}
