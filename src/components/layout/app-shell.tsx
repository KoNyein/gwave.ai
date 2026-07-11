import { LeftSidebar } from "@/components/layout/left-sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Navbar } from "@/components/layout/navbar";
import { RightSidebar } from "@/components/layout/right-sidebar";
import { ChatDock } from "@/components/messenger/chat-dock";
import { getCurrentProfile } from "@/lib/auth";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  return (
    <div className="min-h-screen bg-muted">
      <Navbar profile={profile} />
      <div className="mx-auto flex w-full max-w-[1600px] justify-center gap-4 px-0 sm:px-4">
        <LeftSidebar profile={profile} />
        <main className="min-h-[calc(100vh-3.5rem)] w-full max-w-2xl px-3 py-4 sm:px-0">
          {children}
        </main>
        <RightSidebar />
      </div>
      <MobileNav />
      {profile ? (
        <ChatDock
          currentUser={{
            id: profile.id,
            username: profile.username,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
          }}
        />
      ) : null}
    </div>
  );
}
