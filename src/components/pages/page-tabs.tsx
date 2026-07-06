"use client";

import { useTranslations } from "next-intl";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function PageTabs({
  posts,
  about,
}: {
  posts: React.ReactNode;
  about: React.ReactNode;
}) {
  const t = useTranslations("pages");

  return (
    <Tabs defaultValue="posts">
      <TabsList className="w-full justify-start bg-background">
        <TabsTrigger value="posts">{t("tabPosts")}</TabsTrigger>
        <TabsTrigger value="about">{t("tabAbout")}</TabsTrigger>
      </TabsList>
      <TabsContent value="posts">{posts}</TabsContent>
      <TabsContent value="about">{about}</TabsContent>
    </Tabs>
  );
}
