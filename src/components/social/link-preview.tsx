"use client";

import * as React from "react";

const URL_RE = /https?:\/\/[^\s<>"')\]]+/;

interface Preview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

/**
 * WhatsApp/Facebook-style rich preview card for the first URL in a piece of
 * user text: image, title, description and domain, all tappable. Renders
 * nothing until the preview endpoint returns something worth showing.
 */
export function LinkPreview({ text }: { text: string }) {
  const url = React.useMemo(() => {
    const m = text.match(URL_RE);
    return m ? m[0].replace(/[).,!?၊။…]+$/, "") : null;
  }, [text]);
  const [preview, setPreview] = React.useState<Preview | null>(null);

  React.useEffect(() => {
    if (!url) return;
    let cancelled = false;
    void fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((res) => (res.ok ? (res.json() as Promise<Preview>) : null))
      .then((data) => {
        if (!cancelled && data && (data.title || data.image)) setPreview(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!url || !preview) return null;

  let host = "";
  try {
    host = new URL(preview.url).hostname.replace(/^www\./, "");
  } catch {
    /* leave empty */
  }
  const internal = host === "gwave.cc";

  return (
    <a
      href={internal ? preview.url.replace(/^https?:\/\/(www\.)?gwave\.cc/, "") || "/" : preview.url}
      target={internal ? undefined : "_blank"}
      rel={internal ? undefined : "noopener noreferrer nofollow"}
      className="block overflow-hidden rounded-xl border transition-colors hover:bg-muted/40"
    >
      {preview.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview.image}
          alt=""
          loading="lazy"
          className="max-h-64 w-full bg-muted object-cover"
        />
      ) : null}
      <div className="space-y-0.5 p-3">
        {preview.title ? (
          <p className="line-clamp-2 text-sm font-semibold">{preview.title}</p>
        ) : null}
        {preview.description ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {preview.description}
          </p>
        ) : null}
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {host}
        </p>
      </div>
    </a>
  );
}
