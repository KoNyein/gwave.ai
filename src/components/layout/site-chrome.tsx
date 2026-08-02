import { MobileNav } from "@/components/layout/mobile-nav";
import { Navbar } from "@/components/layout/navbar";
import { isEmbedded } from "@/lib/embed";

/// The site header, hidden when the page is rendered inside the Gwave app.
///
/// ★ Navbar and MobileNav are client components, so they cannot read cookies
///   themselves. These server wrappers do the check once and every layout
///   gets the behaviour by using them instead — rather than nine layouts each
///   remembering to ask.
export async function SiteNavbar({
  profile,
}: {
  profile: React.ComponentProps<typeof Navbar>["profile"];
}) {
  if (await isEmbedded()) return null;
  return <Navbar profile={profile} />;
}

/// The bottom tab bar, hidden inside the app — where it landed underneath the
/// app's own tab bar and got clipped off the screen.
export async function SiteMobileNav() {
  if (await isEmbedded()) return null;
  return <MobileNav />;
}
