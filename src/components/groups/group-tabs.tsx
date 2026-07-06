"use client";

import { useTranslations } from "next-intl";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function GroupTabs({
  discussion,
  members,
  requests,
  requestCount = 0,
}: {
  discussion: React.ReactNode;
  members: React.ReactNode;
  /** Admin-only pending requests tab (null hides it). */
  requests?: React.ReactNode;
  requestCount?: number;
}) {
  const t = useTranslations("groups");

  return (
    <Tabs defaultValue="discussion">
      <TabsList className="w-full justify-start bg-background">
        <TabsTrigger value="discussion">{t("tabDiscussion")}</TabsTrigger>
        <TabsTrigger value="members">{t("tabMembers")}</TabsTrigger>
        {requests ? (
          <TabsTrigger value="requests">
            {t("tabRequests")}
            {requestCount > 0 ? (
              <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                {requestCount}
              </span>
            ) : null}
          </TabsTrigger>
        ) : null}
      </TabsList>
      <TabsContent value="discussion">{discussion}</TabsContent>
      <TabsContent value="members">{members}</TabsContent>
      {requests ? <TabsContent value="requests">{requests}</TabsContent> : null}
    </Tabs>
  );
}
