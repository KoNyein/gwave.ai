"use client";

import * as React from "react";
import { Play, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tab = "html" | "css" | "js";

/**
 * A live HTML/CSS/JS editor. The preview runs inside a sandboxed iframe with
 * `allow-scripts` only (no `allow-same-origin`), so learner code executes in an
 * opaque origin — it cannot read cookies, call our APIs, or touch the parent
 * page. Nothing is persisted or sent anywhere.
 */
export function CodePlayground({
  starter,
}: {
  starter: { html: string; css: string; js: string };
}) {
  const [tab, setTab] = React.useState<Tab>("html");
  const [code, setCode] = React.useState(starter);
  const [srcDoc, setSrcDoc] = React.useState("");

  const build = React.useCallback(
    () =>
      `<!doctype html><html><head><meta charset="utf-8"><style>${code.css}</style></head><body>${code.html}<script>try{${code.js}}catch(e){document.body.insertAdjacentHTML('beforeend','<pre style=\\'color:crimson\\'>'+e+'</pre>')}<\/script></body></html>`,
    [code],
  );

  // Run once on mount so learners see output immediately.
  React.useEffect(() => {
    setSrcDoc(build());
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            onClick={() => setCode(starter)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        </div>
        <textarea
          spellCheck={false}
          value={code[tab]}
          onChange={(e) => setCode({ ...code, [tab]: e.target.value })}
          className="h-64 w-full resize-none bg-background p-3 font-mono text-xs outline-none"
          aria-label={`${tab} code editor`}
        />
        <div className="border-t p-2">
          <Button size="sm" className="w-full" onClick={() => setSrcDoc(build())}>
            <Play className="mr-1 h-4 w-4" /> Run
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <div className="border-b bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
          Preview
        </div>
        <iframe
          title="Code preview"
          sandbox="allow-scripts"
          srcDoc={srcDoc}
          className="h-[19rem] w-full bg-white"
        />
      </div>
    </div>
  );
}
