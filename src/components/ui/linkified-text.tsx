import * as React from "react";
import Link from "next/link";

// Only http(s) URLs are ever linkified, so javascript:/data: schemes can
// never become clickable through user-supplied text.
const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;
const INTERNAL_HOSTS = new Set(["gwave.cc", "www.gwave.cc"]);

/**
 * Renders user text with URLs turned into working links. Internal gwave.cc
 * links navigate in-app (client-side, keeps the TWA inside the app); external
 * links open in a new tab with rel isolation. Trailing sentence punctuation is
 * kept out of the href.
 */
export function LinkifiedText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let key = 0;

  for (const match of text.matchAll(URL_RE)) {
    const raw = match[0];
    const start = match.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));

    const url = raw.replace(/[).,!?၊။…]+$/, "");
    const trailing = raw.slice(url.length);
    let node: React.ReactNode = raw;
    try {
      const parsed = new URL(url);
      const className =
        "font-medium text-primary underline underline-offset-2 hover:opacity-80";
      node = INTERNAL_HOSTS.has(parsed.hostname) ? (
        <Link key={key++} href={parsed.pathname + parsed.search} className={className}>
          {url}
        </Link>
      ) : (
        <a
          key={key++}
          href={url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className={className}
        >
          {url}
        </a>
      );
    } catch {
      // Unparseable — leave as plain text.
    }
    parts.push(node);
    if (node !== raw && trailing) parts.push(trailing);
    last = start + raw.length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
