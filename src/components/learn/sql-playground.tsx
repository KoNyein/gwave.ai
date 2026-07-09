"use client";

import * as React from "react";
import { Database, Loader2, Play, RotateCcw, Square } from "lucide-react";
import { useTranslations } from "next-intl";

import { CodeEditor } from "@/components/learn/code-editor";
import {
  reportLessonComplete,
  useProjectAutosave,
  type LessonRef,
} from "@/components/learn/use-learn-progress";
import { Button } from "@/components/ui/button";

// sql.js is SQLite compiled to WebAssembly — a full SQL engine that runs
// entirely in the browser. Loaded lazily from jsdelivr (allowlisted in the
// CSP) the first time a learner runs a query.
const SQLJS_VERSION = "1.11.0";
const SQLJS_BASE = `https://cdn.jsdelivr.net/npm/sql.js@${SQLJS_VERSION}/dist/`;

// A single query may run this long before we assume it's stuck (e.g. a
// runaway recursive CTE) and terminate the worker.
const RUN_TIMEOUT_MS = 10000;

interface SqlResult {
  columns: string[];
  values: (string | number | null)[][];
}

// A small demo database every SQL lesson can query against.
const SEED_SQL = `
CREATE TABLE growers (id INTEGER PRIMARY KEY, name TEXT, city TEXT, plants INTEGER);
INSERT INTO growers VALUES
  (1, 'Mai',   'Yangon',    12),
  (2, 'Aung',  'Mandalay',   5),
  (3, 'Su',    'Yangon',    20),
  (4, 'Kyaw',  'Taunggyi',   8),
  (5, 'Nilar', 'Mandalay',  15);

CREATE TABLE strains (id INTEGER PRIMARY KEY, name TEXT, type TEXT, weeks INTEGER, grower_id INTEGER);
INSERT INTO strains VALUES
  (1, 'Blue Dream',      'hybrid', 9, 1),
  (2, 'OG Kush',         'indica', 8, 3),
  (3, 'Sour Diesel',     'sativa', 10, 1),
  (4, 'Northern Lights', 'indica', 7, 5);
`;

// sql.js runs inside a Web Worker so a runaway query never freezes the page:
// the main thread stays responsive and we terminate the worker when it
// overruns or the learner presses Stop. Built as a Blob URL — no worker file
// to ship. The seed schema is embedded so every run starts from a clean DB.
const WORKER_SOURCE = `
let sqlReady = null;
async function getSql() {
  if (!sqlReady) {
    importScripts("${SQLJS_BASE}sql-wasm.js");
    sqlReady = initSqlJs({ locateFile: (f) => "${SQLJS_BASE}" + f });
  }
  return sqlReady;
}
const SEED = ${JSON.stringify(SEED_SQL)};
self.onmessage = async (e) => {
  try {
    const SQL = await getSql();
    self.postMessage({ type: "loaded" });
    const db = new SQL.Database();
    db.run(SEED);
    const results = db.exec(e.data.code);
    db.close();
    self.postMessage({ type: "result", results: results });
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
 * A real SQL editor + runner backed by an in-browser SQLite database
 * (sql.js) running in a worker. Every run rebuilds the seeded demo database,
 * executes the learner's SQL, and renders the result set as a table. Marks
 * the lesson complete after a successful run.
 */
export function SqlPlayground({
  starter,
  lesson,
  title = "SQL practice",
}: {
  starter: string;
  lesson?: LessonRef;
  title?: string;
}) {
  const t = useTranslations("learn");
  const [code, setCode] = React.useState(() =>
    restoreCode(starter, lesson?.initialData ?? null),
  );
  const [results, setResults] = React.useState<SqlResult[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<"idle" | "loading" | "running">(
    "idle",
  );
  const [resetKey, setResetKey] = React.useState(0);

  useProjectAutosave(lesson, "sql", title, { code });

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
    setError(null);
    setResults(null);
    setStatus("loading");

    const blob = new Blob([WORKER_SOURCE], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    blobUrlRef.current = url;
    const worker = new Worker(url);
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data as
        | { type: "loaded" }
        | { type: "result"; results: SqlResult[] }
        | { type: "error"; error: string };

      if (msg.type === "loaded") {
        setStatus("running");
        timerRef.current = setTimeout(() => {
          teardownWorker();
          setError(t("runTimeout"));
          setStatus("idle");
        }, RUN_TIMEOUT_MS);
        return;
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (msg.type === "result") {
        setResults(msg.results);
        reportLessonComplete(lessonRef.current);
      } else {
        setError(msg.error || t("engineError"));
      }
      setStatus("idle");
      teardownWorker();
    };
    worker.onerror = () => {
      teardownWorker();
      setError(t("engineError"));
      setStatus("idle");
    };

    worker.postMessage({ code });
  }

  function stop() {
    teardownWorker();
    setError(t("runStopped"));
    setStatus("idle");
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border">
        <div className="flex items-center justify-between border-b bg-muted px-2 py-1.5">
          <span className="px-1 text-xs font-medium text-muted-foreground">
            query.sql
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
          language="sql"
          onChange={setCode}
          heightClass="h-40"
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
                <Play className="mr-1 h-4 w-4" /> {t("runQuery")}
              </>
            ) : (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                {status === "loading" ? t("loadingSql") : t("running")}
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
        <div className="flex items-center gap-1.5 border-b bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <Database className="h-3.5 w-3.5" /> {t("result")}
        </div>
        <div className="max-h-72 overflow-auto p-2">
          {error ? (
            <p className="p-2 font-mono text-xs text-destructive">{error}</p>
          ) : results && results.length > 0 ? (
            results.map((table, i) => (
              <table key={i} className="mb-3 w-full text-xs">
                <thead>
                  <tr>
                    {table.columns.map((col) => (
                      <th
                        key={col}
                        className="border-b bg-muted px-2 py-1 text-left font-semibold"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.values.map((row, r) => (
                    <tr key={r} className="border-b last:border-0">
                      {row.map((cell, c) => (
                        <td key={c} className="px-2 py-1">
                          {cell === null ? "NULL" : String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ))
          ) : (
            <p className="p-2 text-xs text-muted-foreground">
              {results ? t("sqlNoRows") : t("sqlHint")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
