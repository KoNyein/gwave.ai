import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Award,
  BookOpen,
  FileText,
  Package,
  Rocket,
  Store,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";

import { UserAvatar } from "@/components/social/user-avatar";
import { MemberBadge } from "@/components/social/member-badge";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { getCertificatesForUser } from "@/lib/db/certificates";
import { getMyGpayAccount } from "@/lib/db/gpay";
import { getLearningPoints } from "@/lib/db/learn";
import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/format";

export const metadata = { title: "My dashboard" };
export const dynamic = "force-dynamic";

interface Stat {
  label: string;
  value: string;
  hint?: string;
  href: string;
  icon: typeof Users;
}

/** Personal overview: one page that answers "ငါ ဘာတွေလုပ်ထားပြီးပြီလဲ". */
export default async function UserDashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const [
    postsRes,
    friendsRes,
    lessonsRes,
    ordersRes,
    listingsRes,
    certificates,
    points,
    gpay,
  ] = await Promise.all([
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("author_id", profile.id),
    supabase
      .from("friendships")
      .select("id", { count: "exact", head: true })
      .eq("status", "accepted")
      .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`),
    supabase
      .from("lesson_progress")
      .select("lesson_slug", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("status", "completed"),
    supabase
      .from("shop_orders")
      .select("id", { count: "exact", head: true })
      .eq("buyer_id", profile.id),
    supabase
      .from("shop_products")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", profile.id),
    getCertificatesForUser(profile.id),
    getLearningPoints(profile.id),
    getMyGpayAccount(),
  ]);

  const listings = listingsRes.count ?? 0;

  const stats: Stat[] = [
    {
      label: "Post များ",
      value: String(postsRes.count ?? 0),
      href: "/profile",
      icon: FileText,
    },
    {
      label: "မိတ်ဆွေများ",
      value: String(friendsRes.count ?? 0),
      href: "/friends",
      icon: Users,
    },
    {
      label: "ပြီးမြောက်တဲ့ သင်ခန်းစာ",
      value: String(lessonsRes.count ?? 0),
      hint: `⭐ Point ${points.toLocaleString("en-US")}`,
      href: "/learn",
      icon: BookOpen,
    },
    {
      label: "လက်မှတ်များ",
      value: String(certificates.length),
      href: "/learn",
      icon: Award,
    },
    {
      label: "ဝယ်ယူထားတဲ့ order",
      value: String(ordersRes.count ?? 0),
      href: "/shop/orders",
      icon: Package,
    },
    {
      label: "ရောင်းချနေတဲ့ ပစ္စည်း",
      value: String(listings),
      hint: listings > 0 ? "Seller dashboard ကြည့်ရန်" : "စတင်ရောင်းရန်",
      href: listings > 0 ? "/shop/dashboard" : "/shop/sell",
      icon: Store,
    },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">📊 ကျွန်ုပ်၏ Dashboard</h1>

      {/* Identity strip */}
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <UserAvatar profile={profile} className="h-14 w-14" linked={false} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 truncate font-semibold">
              {displayName(profile)} <MemberBadge role={profile.role} />
            </p>
            <p className="truncate text-sm text-muted-foreground">
              @{profile.username}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/profile"
              className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              Profile
            </Link>
            <Link
              href="/settings"
              className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              Settings
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* G-Pay balance banner (only when the wallet exists) */}
      {gpay ? (
        <Link href="/gpay" className="block">
          <Card className="border-primary/30 bg-primary/5 transition-colors hover:bg-primary/10">
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Wallet className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">G-Pay လက်ကျန်</p>
                <p className="text-xl font-bold">
                  {gpay.balance.toLocaleString("en-US")} Ks
                </p>
              </div>
              <span className="text-sm font-medium text-primary">ကြည့်ရန် →</span>
            </CardContent>
          </Card>
        </Link>
      ) : null}

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href} className="block">
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardContent className="p-4">
                  <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  {stat.hint ? (
                    <p className="mt-0.5 text-[11px] text-primary">{stat.hint}</p>
                  ) : null}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Certificates strip */}
      {certificates.length > 0 ? (
        <Card>
          <CardContent className="p-4">
            <p className="mb-2 flex items-center gap-1.5 font-semibold">
              <Award className="h-4 w-4 text-primary" /> ရရှိထားတဲ့ လက်မှတ်များ
            </p>
            <div className="flex flex-wrap gap-2">
              {certificates.slice(0, 6).map((cert) => (
                <Link
                  key={cert.id}
                  href={`/learn/certificate/${cert.id}`}
                  className="rounded-full border px-3 py-1 text-sm hover:bg-muted"
                >
                  🎓 {cert.track_title}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Quick actions */}
      <Card>
        <CardContent className="p-4">
          <p className="mb-2 font-semibold">⚡ အမြန် လုပ်ဆောင်ရန်</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/leaderboard"
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              <Trophy className="h-4 w-4 text-primary" /> အဆင့်ဇယား
            </Link>
            <Link
              href="/boost"
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              <Rocket className="h-4 w-4 text-primary" /> Boost
            </Link>
            <Link
              href="/shop/guide"
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              <Store className="h-4 w-4 text-primary" /> ရောင်းချနည်း လမ်းညွှန်
            </Link>
            <Link
              href="/help"
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              📖 အကူအညီ
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
