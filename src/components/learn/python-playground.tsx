"use client";

import * as React from "react";
import { Loader2, Play, RotateCcw, Square } from "lucide-react";
import { useTranslations } from "next-intl";

import { CodeEditor } from "@/components/learn/code-editor";
import {
  reportLessonComplete,
  useProjectAutosave,
  type LessonRef,
} from "@/components/learn/use-learn-progress";
import { Button } from "@/components/ui/button";

// Pyodide runs CPython compiled to WebAssembly entirely in the browser — no
// backend, no server round-trip. It's loaded once, lazily, from jsdelivr
// (allowlisted in the CSP) the first time a learner runs Python.
const PYODIDE_VERSION = "0.26.2";
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

// A single run may execute this long before we assume it's stuck (e.g. an
// accidental `while True:`) and terminate the worker.
const RUN_TIMEOUT_MS = 15000;

// Pyodide runs inside a Web Worker so a learner's infinite loop never freezes
// the page: the main thread stays responsive and we simply terminate the
// worker when it overruns or the learner presses Stop. Built as a Blob URL so
// there's no separate worker file to ship.
const WORKER_SOURCE = `
let pyodideReady = null;
async function getPyodide() {
  if (!pyodideReady) {
    importScripts("${PYODIDE_BASE}pyodide.js");
    pyodideReady = loadPyodide({ indexURL: "${PYODIDE_BASE}" });
  }
  return pyodideReady;
}
self.onmessage = async (e) => {
  try {
    const pyodide = await getPyodide();
    self.postMessage({ type: "loaded" });
    const chunks = [];
    const collect = { batched: (s) => chunks.push(s) };
    pyodide.setStdout(collect);
    pyodide.setStderr(collect);
    await pyodide.runPythonAsync(e.data.code);
    self.postMessage({ type: "result", output: chunks.join("\\n") });
  } catch (err) {
    self.postMessage({
      type: "error",
      error: err && err.message ? err.message : String(err),
    });
  }
};
`;

function restoreCode(starter: string, saved: Record<string, unknown> | null) {
  return saved && typeof saved.code === "string" ? saved.code : starter;
}

/**
 * A real Python editor + runner. Learners write Python, press Run, and see
 * the actual interpreter output — like the "Try it Yourself" panels on
 * classic tutorial sites, but running client-side in a worker so runaway
 * loops can't hang the tab. Autosaves via the member-project system and marks
 * the lesson complete after a successful run.
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

  // Keep the latest lesson ref for the async completion callback.
  const lessonRef = React.useRef(lesson);
  lessonRef.current = lesson;

  const workerRef = React.useRef<Worker | null>(null);
  const blobUrlRef = React.useRef<string | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const teardownWorker = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  React.useEffect(() => teardownWorker, [teardownWorker]);

  function run() {
    if (status !== "idle") return;
    setOutput("");
    setStatus("loading");

    const blob = new Blob([WORKER_SOURCE], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    blobUrlRef.current = url;
    const worker = new Worker(url);
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data as
        | { type: "loaded" }
        | { type: "result"; output: string }
        | { type: "error"; error: string };

      if (msg.type === "loaded") {
        setStatus("running");
        timerRef.current = setTimeout(() => {
          teardownWorker();
          setOutput(t("runTimeout"));
          setStatus("idle");
        }, RUN_TIMEOUT_MS);
        return;
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (msg.type === "result") {
        setOutput(msg.output || "(no output)");
        reportLessonComplete(lessonRef.current);
      } else {
        setOutput(msg.error || t("engineError"));
      }
      setStatus("idle");
      teardownWorker();
    };
    worker.onerror = () => {
      teardownWorker();
      setOutput(t("engineError"));
      setStatus("idle");
    };

    worker.postMessage({ code });
  }

  function stop() {
    teardownWorker();
    setOutput(t("runStopped"));
    setStatus("idle");
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
        <div className="flex gap-2 border-t p-2">
          <Button
            size="sm"
            className="flex-1"
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
          {status !== "idle" && (
            <Button size="sm" variant="outline" onClick={stop}>
              <Square className="mr-1 h-4 w-4" /> {t("stop")}
            </Button>
          )}
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
