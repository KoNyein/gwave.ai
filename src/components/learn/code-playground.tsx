"use client";

import * as React from "react";
import { Play, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CodeEditor } from "@/components/learn/code-editor";
import {
  useProjectAutosave,
  type LessonRef,
} from "@/components/learn/use-learn-progress";
import { cn } from "@/lib/utils";

type Tab = "html" | "css" | "js";

type CodeState = { html: string; css: string; js: string };

function restoreCode(
  starter: CodeState,
  saved: Record<string, unknown> | null | undefined,
): CodeState {
  if (
    saved &&
    typeof saved.html === "string" &&
    typeof saved.css === "string" &&
    typeof saved.js === "string"
  ) {
    return { html: saved.html, css: saved.css, js: saved.js };
  }
  return starter;
}

/** Assemble the full runnable document from the three editors. */
function buildDoc(code: CodeState): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${code.css}</style></head><body>${code.html}<script>try{${code.js}}catch(e){document.body.insertAdjacentHTML('beforeend','<pre style=\\'color:crimson\\'>'+e+'</pre>')}<\/script></body></html>`;
}

/**
 * A live HTML/CSS/JS editor. The preview runs inside a sandboxed iframe with
 * `allow-scripts` only (no `allow-same-origin`), so learner code executes in an
 * opaque origin — it cannot read cookies, call our APIs, or touch the parent
 * page. With a `lesson` ref the code is auto-saved (debounced) so the learner
 * can resume where they left off.
 */
export function CodePlayground({
  starter,
  lesson,
  title = "My web page",
  tall = false,
}: {
  starter: CodeState;
  lesson?: LessonRef;
  title?: string;
  /** Larger editor + preview for the standalone practice page. */
  tall?: boolean;
}) {
  const [tab, setTab] = React.useState<Tab>("html");
  const [code, setCode] = React.useState<CodeState>(() =>
    restoreCode(starter, lesson?.initialData),
  );
  const [srcDoc, setSrcDoc] = React.useState(() => buildDoc(code));
  // Bumps to remount the editors after Reset loads new documents.
  const [resetKey, setResetKey] = React.useState(0);
  // Bumps to remount the preview iframe on every Run, so it re-executes even
  // when the assembled document is byte-for-byte identical (otherwise React
  // sees the same srcDoc string and never reloads the frame → "Run" looks dead).
  const [runKey, setRunKey] = React.useState(0);

  useProjectAutosave(lesson, "code", title, code);

  const run = React.useCallback((next: CodeState) => {
    setSrcDoc(buildDoc(next));
    setRunKey((k) => k + 1);
  }, []);

  const TABS: { id: Tab; label: string }[] = [
    { id: "html", label: "HTML" },
    { id: "css", label: "CSS" },
    { id: "js", label: "JavaScript" },
  ];

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="overflow-hidden rounded-xl border">
        <div className="flex items-center justify-between border-b bg-muted px-2 py-1.5">
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium",
                  tab === t.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setCode(starter);
              setResetKey((k) => k + 1);
              run(starter);
            }}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        </div>
        {/* Keyed per tab + reset so each document keeps its own editor
            (undo history, highlighting, autocompletion). */}
        <CodeEditor
          key={`${tab}-${resetKey}`}
          value={code[tab]}
          language={tab}
          onChange={(next) =>
            setCode((previous) => ({ ...previous, [tab]: next }))
          }
          heightClass={tall ? "h-[28rem]" : "h-64"}
        />
        <div className="border-t p-2">
          <Button size="sm" className="w-full" onClick={() => run(code)}>
            <Play className="mr-1 h-4 w-4" /> Run
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <div className="border-b bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
          Preview
        </div>
        <iframe
          key={runKey}
          title="Code preview"
          sandbox="allow-scripts"
          srcDoc={srcDoc}
          className={cn("w-full bg-white", tall ? "h-[32rem]" : "h-[19rem]")}
        />
      </div>
    </div>
  );
}
