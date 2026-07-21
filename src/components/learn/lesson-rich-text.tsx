import React from "react";

/**
 * Lightweight formatter for lesson body text (server-rendered, no HTML
 * injection — everything stays plain React text nodes).
 *
 * Block level: blank lines split paragraphs; consecutive `- ` / `• ` / `* `
 * lines become a bulleted list; `1. ` style lines become a numbered list;
 * lines opening with 💡 ⚠️ 📌 ✅ ❗ render as tinted callouts.
 * Inline: `code` spans and **bold** runs.
 */

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("`")) {
      parts.push(
        <code
          key={i++}
          className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[0.85em] font-medium text-primary"
        >
          {tok.slice(1, -1)}
        </code>,
      );
    } else {
      parts.push(
        <strong key={i++} className="font-semibold text-foreground">
          {tok.slice(2, -2)}
        </strong>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 ? parts[0] : parts;
}

const CALLOUTS: Record<string, { border: string; bg: string }> = {
  "💡": { border: "border-amber-400/50", bg: "bg-amber-400/10" },
  "⚠️": { border: "border-red-400/50", bg: "bg-red-400/10" },
  "❗": { border: "border-red-400/50", bg: "bg-red-400/10" },
  "📌": { border: "border-sky-400/50", bg: "bg-sky-400/10" },
  "✅": { border: "border-primary/50", bg: "bg-primary/10" },
};

type Block =
  | { type: "p"; lines: string[] }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "callout"; emoji: string; text: string };

function parseBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  for (const rawLine of body.split("\n")) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    const last = blocks[blocks.length - 1];

    if (!trimmed) continue; // blank line = block separator (handled by push logic)

    const bullet = /^[-•*]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      const item = bullet[1] ?? "";
      if (last?.type === "ul") last.items.push(item);
      else blocks.push({ type: "ul", items: [item] });
      continue;
    }
    const numbered = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (numbered) {
      const item = numbered[1] ?? "";
      if (last?.type === "ol") last.items.push(item);
      else blocks.push({ type: "ol", items: [item] });
      continue;
    }
    const emoji = Object.keys(CALLOUTS).find((e) => trimmed.startsWith(e));
    if (emoji) {
      blocks.push({
        type: "callout",
        emoji,
        text: trimmed.slice(emoji.length).trim(),
      });
      continue;
    }
    // Plain text line → its own paragraph (lesson bodies use single newlines
    // for new thoughts, so each line reads as a paragraph).
    blocks.push({ type: "p", lines: [trimmed] });
  }
  return blocks;
}

export function LessonRichText({ body }: { body: string }) {
  const blocks = parseBlocks(body);
  return (
    <div className="space-y-2.5">
      {blocks.map((b, i) => {
        if (b.type === "ul") {
          return (
            <ul key={i} className="space-y-1.5 pl-1">
              {b.items.map((item, j) => (
                <li key={j} className="flex gap-2 text-sm leading-relaxed">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span className="text-muted-foreground">
                    {renderInline(item)}
                  </span>
                </li>
              ))}
            </ul>
          );
        }
        if (b.type === "ol") {
          return (
            <ol key={i} className="space-y-1.5 pl-1">
              {b.items.map((item, j) => (
                <li key={j} className="flex gap-2.5 text-sm leading-relaxed">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                    {j + 1}
                  </span>
                  <span className="text-muted-foreground">
                    {renderInline(item)}
                  </span>
                </li>
              ))}
            </ol>
          );
        }
        if (b.type === "callout") {
          const c = CALLOUTS[b.emoji] ?? {
            border: "border-primary/50",
            bg: "bg-primary/10",
          };
          return (
            <div
              key={i}
              className={`flex gap-2.5 rounded-xl border ${c.border} ${c.bg} p-3 text-sm leading-relaxed`}
            >
              <span aria-hidden>{b.emoji}</span>
              <span className="text-foreground/90">{renderInline(b.text)}</span>
            </div>
          );
        }
        return (
          <p key={i} className="text-sm leading-relaxed text-muted-foreground">
            {renderInline(b.lines.join(" "))}
          </p>
        );
      })}
    </div>
  );
}
