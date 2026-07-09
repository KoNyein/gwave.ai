"use client";

import { useTranslations } from "next-intl";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ProfileTabs({
  posts,
  photos,
  about,
  friends,
}: {
  posts: React.ReactNode;
  photos: React.ReactNode;
  about: React.ReactNode;
  friends: React.ReactNode;
}) {
  const t = useTranslations("profile");

  return (
    <Tabs defaultValue="posts">
      <TabsList className="w-full justify-start bg-background">
        <TabsTrigger value="posts">{t("tabPosts")}</TabsTrigger>
        <TabsTrigger value="photos">{t("tabPhotos")}</TabsTrigger>
        <TabsTrigger value="about">{t("tabAbout")}</TabsTrigger>
        <TabsTrigger value="friends">{t("tabFriends")}</TabsTrigger>
      </TabsList>
      <TabsContent value="posts">{posts}</TabsContent>
      <TabsContent value="photos">{photos}</TabsContent>
      <TabsContent value="about">{about}</TabsContent>
      <TabsContent value="friends">{friends}</TabsContent>
    </Tabs>
  );
}
