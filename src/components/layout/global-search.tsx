"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, Gem, Leaf, Search, User } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

interface QuickResults {
  users: {
    id: string;
    username: string | null;
    full_name: string | null;
  }[];
  posts: {
    id: string;
    content: string;
    author: { username: string | null; full_name: string | null } | null;
  }[];
  strains: {
    name: string;
    slug: string;
    type: string;
    thc: number | null;
  }[];
  minerals: {
    name: string;
    slug: string;
    symbol: string | null;
    category: string;
  }[];
}

interface ResultItem {
  key: string;
  href: string;
  icon: typeof Search;
  title: string;
  subtitle: string;
  group: "people" | "posts" | "strains" | "minerals";
}

const EMPTY: QuickResults = { users: [], posts: [], strains: [], minerals: [] };

/**
 * Navbar global search: debounced grouped autocomplete over people, posts,
 * strains and minerals. Keyboard navigable (↑/↓/Enter/Escape); Enter with no
 * selection opens the full /search page.
 */
export function GlobalSearch() {
  const t = useTranslations("nav");
  const tSearch = useTranslations("search");
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<QuickResults>(EMPTY);
  const [open, setOpen] = React.useState(false);
  const [highlighted, setHighlighted] = React.useState(-1);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = React.useRef(0);

  React.useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    setHighlighted(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setResults(EMPTY);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const seq = ++requestSeq.current;
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(value.trim())}`,
        );
        if (!response.ok || seq !== requestSeq.current) return;
        const payload: QuickResults = await response.json();
        setResults(payload);
        setOpen(true);
      } catch {
        // Ignore transient search errors.
      }
    }, 250);
  }

  const items: ResultItem[] = [
    ...results.users.map((user) => ({
      key: `user-${user.id}`,
      href: `/u/${user.username}`,
      icon: User,
      title: user.full_name || user.username || "",
      subtitle: user.username ? `@${user.username}` : "",
      group: "people" as const,
    })),
    ...results.posts.map((post) => ({
      key: `post-${post.id}`,
      href: `/p/${post.id}`,
      icon: FileText,
      title: post.content.slice(0, 60),
      subtitle: post.author?.full_name || post.author?.username || "",
      group: "posts" as const,
    })),
    ...results.strains.map((strain) => ({
      key: `strain-${strain.slug}`,
      href: `/strains/${strain.slug}`,
      icon: Leaf,
      title: strain.name,
      subtitle: `${strain.type}${strain.thc ? ` · THC ${strain.thc}%` : ""}`,
      group: "strains" as const,
    })),
    ...results.minerals.map((mineral) => ({
      key: `mineral-${mineral.slug}`,
      href: `/minerals/${mineral.slug}`,
      icon: Gem,
      title: mineral.name,
      subtitle: `${mineral.category}${mineral.symbol ? ` · ${mineral.symbol}` : ""}`,
      group: "minerals" as const,
    })),
  ];

  function navigate(href: string) {
    setOpen(false);
    setQuery("");
    setResults(EMPTY);
    router.push(href);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlighted((index) => Math.min(index + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((index) => Math.max(index - 1, -1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = items[highlighted];
      if (item) {
        navigate(item.href);
      } else if (query.trim()) {
        navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const GROUP_LABELS: Record<ResultItem["group"], string> = {
    people: tSearch("people"),
    posts: tSearch("posts"),
    strains: tSearch("strains"),
    minerals: tSearch("minerals"),
  };
  let previousGroup: ResultItem["group"] | null = null;

  return (
    <div ref={containerRef} className="relative hidden md:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={query}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (items.length > 0) setOpen(true);
        }}
        placeholder={t("search")}
        aria-label={t("search")}
        role="combobox"
        aria-expanded={open}
        aria-controls="global-search-results"
        className="h-10 w-56 rounded-full border border-input bg-muted pl-9 pr-4 text-sm outline-none transition-colors focus:bg-background focus:ring-1 focus:ring-ring lg:w-72"
      />

      {open ? (
        <div
          id="global-search-results"
          className="absolute left-0 top-full z-50 mt-1 max-h-[70vh] w-80 overflow-y-auto rounded-lg border bg-background p-1.5 shadow-lg"
        >
          {items.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              {tSearch("noResults")}
            </p>
          ) : (
            <>
              {items.map((item, index) => {
                const Icon = item.icon;
                const showHeader = item.group !== previousGroup;
                previousGroup = item.group;
                return (
                  <React.Fragment key={item.key}>
                    {showHeader ? (
                      <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase text-muted-foreground">
                        {GROUP_LABELS[item.group]}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => navigate(item.href)}
                      onMouseEnter={() => setHighlighted(index)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left",
                        index === highlighted && "bg-muted",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {item.title}
                        </span>
                        {item.subtitle ? (
                          <span className="block truncate text-xs capitalize text-muted-foreground">
                            {item.subtitle}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </React.Fragment>
                );
              })}
              <button
                type="button"
                onClick={() =>
                  navigate(`/search?q=${encodeURIComponent(query.trim())}`)
                }
                className="mt-1 w-full rounded-md border-t px-3 py-2 text-center text-sm font-medium text-primary hover:bg-muted"
              >
                {tSearch("seeAllResults", { query: query.trim() })}
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
