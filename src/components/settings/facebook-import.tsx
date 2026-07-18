"use client";

import * as React from "react";
import Link from "next/link";
import { Check, FileArchive, Loader2, Upload } from "lucide-react";
import { useLocale } from "next-intl";

import { createPost } from "@/lib/actions/posts";
import { uploadMedia, type UploadedMedia } from "@/lib/media";
import { prefersMyanmarScript } from "@/i18n/config";

const MAX_IMPORT_PER_RUN = 50;
const MAX_PHOTOS_PER_POST = 10;

interface ParsedPost {
  text: string;
  date: string; // YYYY-MM-DD
  timestamp: number;
  mediaPaths: string[];
  selected: boolean;
}

/**
 * Facebook's JSON export escapes UTF-8 bytes as latin-1 code points, so
 * Burmese text arrives as mojibake. Re-read the code points as UTF-8 bytes.
 */
function fixEncoding(s: string): string {
  try {
    return new TextDecoder("utf-8").decode(
      Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff),
    );
  } catch {
    return s;
  }
}

interface FbAttachment {
  data?: Array<{ media?: { uri?: string } }>;
}
interface FbPost {
  timestamp?: number;
  data?: Array<{ post?: string }>;
  attachments?: FbAttachment[];
}

/**
 * Restore posts from a Facebook "Download Your Information" archive (JSON
 * format) into Gwave. Everything runs in the browser: the ZIP is unpacked
 * locally, the user picks which posts to bring over and their visibility,
 * and photos found in the archive are re-uploaded through the normal media
 * pipeline. Nothing is sent anywhere until Import is pressed.
 */
export function FacebookImport({ userId }: { userId: string }) {
  const mm = prefersMyanmarScript(useLocale());
  const [zip, setZip] = React.useState<import("jszip") | null>(null);
  const [posts, setPosts] = React.useState<ParsedPost[]>([]);
  const [parsing, setParsing] = React.useState(false);
  const [visibility, setVisibility] = React.useState<
    "public" | "friends" | "only_me"
  >("only_me");
  const [progress, setProgress] = React.useState<{
    done: number;
    total: number;
  } | null>(null);
  const [finished, setFinished] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    setParsing(true);
    setError(null);
    setPosts([]);
    setFinished(null);
    try {
      const JSZip = (await import("jszip")).default;
      const archive = await JSZip.loadAsync(file);
      setZip(archive);

      const allNames = Object.keys(archive.files).filter(
        (name) => !archive.files[name]!.dir,
      );
      // Facebook has renamed these files repeatedly — accept any JSON that
      // lives near "post" in its path and let the item-shape check below
      // decide what is actually a post.
      const postFiles = allNames.filter(
        (name) => /post/i.test(name) && /\.json$/i.test(name),
      );
      const htmlPostFiles = allNames.filter(
        (name) => /post/i.test(name) && /\.html?$/i.test(name),
      );

      const parsed: ParsedPost[] = [];
      for (const name of postFiles) {
        const raw = await archive.files[name]!.async("string");
        let items: FbPost[] = [];
        try {
          const json = JSON.parse(raw) as unknown;
          items = Array.isArray(json) ? (json as FbPost[]) : [];
        } catch {
          continue;
        }
        for (const item of items) {
          const text = fixEncoding(
            (item.data ?? [])
              .map((d) => d.post ?? "")
              .filter(Boolean)
              .join("\n\n"),
          ).trim();
          const mediaPaths = (item.attachments ?? [])
            .flatMap((a) => a.data ?? [])
            .map((d) => d.media?.uri ?? "")
            .filter(
              (uri) =>
                uri && /\.(jpe?g|png|gif|webp)$/i.test(uri) && archive.files[uri],
            )
            .slice(0, MAX_PHOTOS_PER_POST);
          if (!text && mediaPaths.length === 0) continue;
          const ts = (item.timestamp ?? 0) * 1000;
          parsed.push({
            text,
            timestamp: ts,
            date: ts ? new Date(ts).toISOString().slice(0, 10) : "",
            mediaPaths,
            selected: true,
          });
        }
      }
      // HTML-format archive (the disabled-account quick download often gives
      // no format choice): best-effort DOM parse of the posts pages.
      if (parsed.length === 0 && htmlPostFiles.length > 0) {
        const domParser = new DOMParser();
        for (const name of htmlPostFiles) {
          const html = await archive.files[name]!.async("string");
          const doc = domParser.parseFromString(html, "text/html");
          // 2022+ exports wrap each post in a `_a6-g` block; older ones use
          // `pam`. Fall back to nothing rather than importing page chrome.
          const blocks = doc.querySelectorAll('[class*="_a6-g"], .pam');
          for (const block of Array.from(blocks)) {
            const text = (
              block.querySelector('[class*="_2pin"]')?.textContent ??
              block.textContent ??
              ""
            ).trim();
            const mediaPaths = Array.from(block.querySelectorAll("img"))
              .map((img) => img.getAttribute("src") ?? "")
              .filter(
                (src) =>
                  src &&
                  !src.startsWith("http") &&
                  /\.(jpe?g|png|gif|webp)$/i.test(src) &&
                  archive.files[src],
              )
              .slice(0, MAX_PHOTOS_PER_POST);
            if (!text && mediaPaths.length === 0) continue;
            parsed.push({
              text: text.slice(0, 5000),
              timestamp: 0,
              date: "",
              mediaPaths,
              selected: true,
            });
          }
        }
      }

      parsed.sort((a, b) => b.timestamp - a.timestamp);
      setPosts(parsed);
      if (parsed.length === 0) {
        // Show what IS in the archive so the structure can be diagnosed from
        // a screenshot.
        const folders = [
          ...new Set(
            allNames.map((n) => n.split("/").slice(0, 2).join("/")),
          ),
        ].slice(0, 8);
        setError(
          (mm
            ? "Post တစ်ခုမှ မတွေ့ပါ။ ZIP ထဲမှာ ပါတာတွေ — "
            : "No posts were found in this archive. The ZIP contains: ") +
            folders.join(", "),
        );
      }
    } catch {
      setError(
        mm
          ? "ZIP ဖိုင်ကို ဖတ်လို့မရပါ — Facebook က ဒေါင်းထားတဲ့ ZIP အပြည့်အစုံ ဟုတ်မဟုတ် စစ်ပါ။"
          : "Could not read the ZIP — make sure it is the full archive downloaded from Facebook.",
      );
    } finally {
      setParsing(false);
    }
  }

  async function runImport() {
    if (!zip || progress) return;
    const selected = posts.filter((p) => p.selected).slice(0, MAX_IMPORT_PER_RUN);
    if (selected.length === 0) return;
    setProgress({ done: 0, total: selected.length });
    setError(null);
    let imported = 0;
    for (const post of selected) {
      try {
        const media: UploadedMedia[] = [];
        for (const path of post.mediaPaths) {
          const entry = zip.files[path];
          if (!entry) continue;
          const blob = await entry.async("blob");
          const filename = path.split("/").pop() ?? "photo.jpg";
          media.push(
            await uploadMedia(userId, new File([blob], filename, {
              type: blob.type || "image/jpeg",
            })),
          );
        }
        const content = [
          post.text,
          post.date ? `📥 Facebook · ${post.date}` : "📥 Facebook",
        ]
          .filter(Boolean)
          .join("\n\n");
        const result = await createPost({ content, visibility, media });
        if (result.ok) imported += 1;
      } catch {
        // One bad post shouldn't sink the batch — carry on.
      }
      setProgress((prev) =>
        prev ? { ...prev, done: prev.done + 1 } : prev,
      );
    }
    setProgress(null);
    setFinished(imported);
    // Unselect what was just imported so a second press continues the rest.
    setPosts((prev) => {
      const importedSet = new Set(selected);
      return prev.filter((p) => !importedSet.has(p));
    });
  }

  const selectedCount = posts.filter((p) => p.selected).length;

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <FileArchive className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">
          {mm ? "Facebook က ပြန်သွင်းရန်" : "Import from Facebook"}
        </h2>
      </div>
      <p className="text-xs text-muted-foreground">
        {mm
          ? "Facebook ရဲ့ \"Download Your Information\" ZIP (JSON format) ကို ရွေးပါ။ Post တွေနဲ့ ဓာတ်ပုံတွေကို Gwave ထဲ ပြန်တင်ပေးမယ် — Import မနှိပ်မချင်း ဘာမှ မပို့ပါ။"
          : 'Choose your Facebook "Download Your Information" ZIP (JSON format). Posts and photos are restored into Gwave — nothing is uploaded until you press Import.'}
      </p>

      <input
        type="file"
        accept=".zip,application/zip"
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
        className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
      />

      {parsing ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {mm ? "ZIP ကို ဖတ်နေသည်…" : "Reading the archive…"}
        </p>
      ) : null}

      {posts.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">
              {mm
                ? `Post ${posts.length} ခု တွေ့သည် — ${selectedCount} ခု ရွေးထား`
                : `Found ${posts.length} posts — ${selectedCount} selected`}
            </span>
            <button
              type="button"
              className="text-xs text-primary underline"
              onClick={() =>
                setPosts((prev) => prev.map((p) => ({ ...p, selected: true })))
              }
            >
              {mm ? "အကုန်ရွေး" : "Select all"}
            </button>
            <button
              type="button"
              className="text-xs text-primary underline"
              onClick={() =>
                setPosts((prev) => prev.map((p) => ({ ...p, selected: false })))
              }
            >
              {mm ? "အကုန်ဖြုတ်" : "Select none"}
            </button>
          </div>

          <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-2">
            {posts.slice(0, 200).map((post, index) => (
              <li key={`${post.timestamp}-${index}`}>
                <label className="flex cursor-pointer items-start gap-2 rounded-md p-1.5 text-sm hover:bg-muted/60">
                  <input
                    type="checkbox"
                    checked={post.selected}
                    onChange={() =>
                      setPosts((prev) =>
                        prev.map((p) =>
                          p === post ? { ...p, selected: !p.selected } : p,
                        ),
                      )
                    }
                    className="mt-0.5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 break-words">
                      {post.text || (mm ? "(ဓာတ်ပုံသီးသန့်)" : "(photos only)")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {post.date}
                      {post.mediaPaths.length > 0
                        ? ` · 📷 ${post.mediaPaths.length}`
                        : ""}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={visibility}
              onChange={(e) =>
                setVisibility(e.target.value as typeof visibility)
              }
              className="rounded-lg border bg-background px-2 py-2 text-sm"
            >
              <option value="only_me">
                {mm ? "ကိုယ်တိုင်ပဲမြင် (only me)" : "Only me"}
              </option>
              <option value="friends">
                {mm ? "မိတ်ဆွေများ" : "Friends"}
              </option>
              <option value="public">{mm ? "အများမြင်" : "Public"}</option>
            </select>
            <button
              type="button"
              onClick={() => void runImport()}
              disabled={!!progress || selectedCount === 0}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {progress ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {progress.done}/{progress.total}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  {mm
                    ? `Import (${Math.min(selectedCount, MAX_IMPORT_PER_RUN)} ခု)`
                    : `Import ${Math.min(selectedCount, MAX_IMPORT_PER_RUN)}`}
                </>
              )}
            </button>
            {selectedCount > MAX_IMPORT_PER_RUN ? (
              <span className="text-xs text-muted-foreground">
                {mm
                  ? `တစ်ခါမှာ ${MAX_IMPORT_PER_RUN} ခုအထိပဲ — ပြီးရင် ထပ်နှိပ်ပါ`
                  : `Up to ${MAX_IMPORT_PER_RUN} per run — press again for the rest`}
              </span>
            ) : null}
          </div>
        </>
      ) : null}

      {finished != null ? (
        <p className="flex items-center gap-2 text-sm text-primary">
          <Check className="h-4 w-4" />
          {mm
            ? `${finished} ခု ပြန်သွင်းပြီးပါပြီ —`
            : `Imported ${finished} posts —`}{" "}
          <Link href="/profile" className="font-medium underline">
            {mm ? "Profile မှာကြည့်ရန်" : "view on your profile"}
          </Link>
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
