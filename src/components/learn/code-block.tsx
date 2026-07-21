"use client";

import { useState } from "react";
import { Check, Copy, TerminalSquare } from "lucide-react";

/**
 * Lesson code sample: a dark editor-style block with a title bar (traffic
 * lights + label) and a one-tap copy button.
 */
export function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable (http / permissions) — nothing to do.
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-black/20 bg-[#0d1117] shadow-sm">
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="flex items-center gap-1.5 text-xs font-medium text-white/50">
          <TerminalSquare className="h-3.5 w-3.5" />
          {label ?? "code"}
        </span>
        <button
          type="button"
          onClick={copy}
          className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> Copy
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-[#e6edf3]">
        {code}
      </pre>
    </div>
  );
}
