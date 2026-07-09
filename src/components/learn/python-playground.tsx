"use client";

import * as React from "react";
import { Loader2, Play, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";

import { CodeEditor } from "@/components/learn/code-editor";
import {
  useProjectAutosave,
  type LessonRef,
} from "@/components/learn/use-learn-progress";
import { Button } from "@/components/ui/button";

// Pyodide runs CPython compiled to WebAssembly entirely in the browser — no
// backend, no server round-trip. It's loaded once, lazily, from jsdelivr
// (allowlisted in the CSP) the first time a learner runs Python.
const PYODIDE_VERSION = "0.26.2";
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

interface PyodideInstance {
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (opts: { batched: (s: string) => void }) => void;
  setStderr: (opts: { batched: (s: string) => void }) => void;
}

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideInstance>;
  }
}

let pyodidePromise: Promise<PyodideInstance> | null = null;

/** Load Pyodide once per page and reuse it across every playground. */
function loadPyodideOnce(): Promise<PyodideInstance> {
  if (pyodidePromise) return pyodidePromise;
  pyodidePromise = new Promise<PyodideInstance>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-pyodide]",
    );
    const start = () => {
      window
        .loadPyodide?.({ indexURL: PYODIDE_BASE })
        .then(resolve)
        .catch(reject);
    };
    if (existing) {
      if (window.loadPyodide) start();
      else existing.addEventListener("load", start);
      return;
    }
    const script = document.createElement("script");
    script.src = `${PYODIDE_BASE}pyodide.js`;
    script.dataset.pyodide = "true";
    script.onload = start;
    script.onerror = () => reject(new Error("Failed to load Python runtime."));
    document.head.appendChild(script);
  });
  return pyodidePromise;
}

function restoreCode(starter: string, saved: Record<string, unknown> | null) {
  return saved && typeof saved.code === "string" ? saved.code : starter;
}

/**
 * A real Python editor + runner. Learners write Python, press Run, and see
 * the actual interpreter output — like the "Try it Yourself" panels on
 * classic tutorial sites, but running client-side. Autosaves via the
 * member-project system when a lesson ref is provided.
 */
export function PythonPlayground({
  starter,
  lesson,
  title = "Python practice",
}: {
  starter: string;
  lesson?: LessonRef;
  title?: string;
}) {
  const t = useTranslations("learn");
  const [code, setCode] = React.useState(() =>
    restoreCode(starter, lesson?.initialData ?? null),
  );
  const [output, setOutput] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "loading" | "running">(
    "idle",
  );
  const [resetKey, setResetKey] = React.useState(0);

  useProjectAutosave(lesson, "python", title, { code });

  async function run() {
    setStatus((s) => (s === "idle" ? "loading" : s));
    setOutput("");
    try {
      const pyodide = await loadPyodideOnce();
      setStatus("running");
      const chunks: string[] = [];
      const collect = { batched: (s: string) => chunks.push(s) };
      pyodide.setStdout(collect);
      pyodide.setStderr(collect);
      await pyodide.runPythonAsync(code);
      setOutput(chunks.join("\n") || "(no output)");
    } catch (error) {
      setOutput(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="overflow-hidden rounded-xl border">
        <div className="flex items-center justify-between border-b bg-muted px-2 py-1.5">
          <span className="px-1 text-xs font-medium text-muted-foreground">
            main.py
          </span>
          <button
            type="button"
            onClick={() => {
              setCode(starter);
              setResetKey((k) => k + 1);
            }}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" /> {t("reset")}
          </button>
        </div>
        <CodeEditor
          key={resetKey}
          value={code}
          language="python"
          onChange={setCode}
          heightClass="h-64"
        />
        <div className="border-t p-2">
          <Button
            size="sm"
            className="w-full"
            onClick={run}
            disabled={status !== "idle"}
          >
            {status === "idle" ? (
              <>
                <Play className="mr-1 h-4 w-4" /> {t("runPython")}
              </>
            ) : (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                {status === "loading" ? t("loadingPython") : t("running")}
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <div className="border-b bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
          {t("output")}
        </div>
        <pre className="h-[19rem] overflow-auto whitespace-pre-wrap bg-neutral-950 p-3 font-mono text-xs text-green-400">
          {output || t("pythonHint")}
        </pre>
      </div>
    </div>
  );
}
