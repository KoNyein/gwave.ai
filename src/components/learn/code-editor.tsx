"use client";

import * as React from "react";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, basicSetup } from "codemirror";

export type EditorLanguage = "html" | "css" | "js";

const LANGUAGES = {
  html: () => html(),
  css: () => css(),
  js: () => javascript(),
};

/**
 * CodeMirror 6 editor: per-language syntax highlighting (keywords,
 * functions, classes and variables in distinct colours), autocompletion as
 * you type, bracket matching and line numbers — all bundled locally, no
 * CDN. Uncontrolled: it initialises from `value` and reports changes up;
 * remount (change `key`) to load a different document.
 */
export function CodeEditor({
  value,
  language,
  onChange,
  heightClass = "h-64",
}: {
  value: string;
  language: EditorLanguage;
  onChange: (next: string) => void;
  heightClass?: string;
}) {
  const host = React.useRef<HTMLDivElement>(null);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  React.useEffect(() => {
    if (!host.current) return;
    const dark = document.documentElement.classList.contains("dark");
    const view = new EditorView({
      doc: value,
      parent: host.current,
      extensions: [
        basicSetup, // includes autocompletion, highlighting, line numbers
        LANGUAGES[language](),
        ...(dark ? [oneDark] : []),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          "&": { fontSize: "12px", height: "100%" },
          ".cm-scroller": { fontFamily: "ui-monospace, monospace" },
        }),
      ],
    });
    return () => view.destroy();
    // The editor owns the document after mount; `value` is initial-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  return (
    <div
      ref={host}
      className={`${heightClass} overflow-auto bg-background text-left [&_.cm-editor]:h-full`}
    />
  );
}
