import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { NAV_SECTIONS, visibleNav } from "@/components/layout/nav-items";
import { getCurrentProfile, isAdultProfile } from "@/lib/auth";

export const metadata = { title: "All features" };
export const dynamic = "force-dynamic";

/**
 * Category-organised directory of every Gwave feature.
 *
 * The sidebar shows the same sections, but with 30+ features a flat link
 * list is easy to get lost in — this page gives each feature a card with a
 * one-line description so newcomers can actually discover what exists.
 * Sections and items come from NAV_SECTIONS (single source of truth), so a
 * feature added to the sidebar automatically appears here too.
 */

/** Per-section accent — keeps categories visually distinct at a glance. */
const SECTION_STYLE: Record<string, { chip: string; icon: string }> = {
  sectionSocial: {
    chip: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
    icon: "bg-sky-500/10 text-sky-600 dark:text-sky-300",
  },
  sectionEntertainment: {
    chip: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
    icon: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  },
  sectionLearn: {
    chip: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    icon: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  },
  sectionFarm: {
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  },
  sectionBusiness: {
    chip: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
    icon: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  },
  sectionKnowledge: {
    chip: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200",
    icon: "bg-teal-500/10 text-teal-600 dark:text-teal-300",
  },
};

export default async function MenuPage() {
  const [tNav, tMenu, profile] = await Promise.all([
    getTranslations("nav"),
    getTranslations("menuPage"),
    getCurrentProfile(),
  ]);
  const isAdult = isAdultProfile(profile);

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">{tMenu("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{tMenu("subtitle")}</p>
      </header>

      {NAV_SECTIONS.map((section) => {
        const style = SECTION_STYLE[section.headingKey] ?? SECTION_STYLE.sectionSocial!;
        // Age-gated entries (strains, farm) are hidden from minors here just
        // like in the sidebar — the route guard is the real enforcement.
        const items = visibleNav(section.items, isAdult).filter(
          // The SOS shortcut duplicates /map in this directory view.
          (item, i, arr) => arr.findIndex((x) => x.href === item.href) === i,
        );
        if (items.length === 0) return null;

        return (
          <section key={section.headingKey}>
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${style.chip}`}
            >
              {tNav(section.headingKey)}
            </span>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={`${section.headingKey}-${item.labelKey}`}
                    href={item.href}
                    className="group flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${style.icon}`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold group-hover:underline">
                        {tNav(item.labelKey)}
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                        {tMenu(`desc.${item.labelKey}`)}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
