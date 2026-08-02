import { LeftSidebar } from "@/components/layout/left-sidebar";
import { RightSidebar } from "@/components/layout/right-sidebar";
import { SiteMobileNav, SiteNavbar } from "@/components/layout/site-chrome";
import { ChatDock } from "@/components/messenger/chat-dock";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { getCurrentProfile } from "@/lib/auth";
import { isEmbedded } from "@/lib/embed";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const [profile, embedded] = await Promise.all([getCurrentProfile(), isEmbedded()]);

  // ★ App ရဲ့ WebView ထဲမှာ ဆိုရင် site ရဲ့ navbar/bottom nav ကို မပြဘူး —
  //   app မှာ ကိုယ်ပိုင် header နဲ့ tab bar ရှိပြီးသား ဖြစ်လို့ ထပ်နေတယ်
  //   (အောက်က tab တန်းက ဖန်သားပြင်အောက် ပြတ်ကျန်နေတယ်)。
  //   Install prompt ကလည်း app ထဲမှာ အဓိပ္ပာယ်မရှိဘူး — install ပြီးသား။
  return (
    <div className="min-h-screen bg-muted">
      <SiteNavbar profile={profile} />
      <div className="mx-auto flex w-full max-w-[1600px] justify-center gap-4 px-0 sm:px-4">
        <LeftSidebar profile={profile} />
        <main
          className={`w-full max-w-2xl px-3 py-4 sm:px-0 ${
            embedded ? "min-h-screen" : "min-h-[calc(100vh-3.5rem)]"
          }`}
        >
          {children}
        </main>
        <RightSidebar />
      </div>
      <SiteMobileNav />
      {embedded ? null : <InstallPrompt />}
      {/* ★ ChatDock (အောက်ညာက စကားပြောပူဖောင်း) ကိုလည်း app ထဲမှာ မပြဘူး
          — app မှာ Messenger tab ရှိပြီးသား ဖြစ်လို့ ထပ်နေတယ်။ */}
      {profile && !embedded ? (
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
