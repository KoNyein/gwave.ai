"use client";

import * as React from "react";

/**
 * Root error boundary. Reports to Sentry when NEXT_PUBLIC_SENTRY_DSN is
 * configured (via the standard envelope endpoint — no SDK bundle needed),
 * and always offers a reset.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;
    try {
      const url = new URL(dsn);
      const projectId = url.pathname.replace("/", "");
      const endpoint = `${url.protocol}//${url.host}/api/${projectId}/envelope/?sentry_key=${url.username}`;
      const event = {
        message: error.message,
        level: "error",
        platform: "javascript",
        exception: {
          values: [
            {
              type: error.name,
              value: error.message,
              ...(error.stack ? { stacktrace: { frames: [] } } : {}),
            },
          ],
        },
        tags: { digest: error.digest ?? "none" },
      };
      const envelope =
        `${JSON.stringify({ sent_at: new Date().toISOString() })}\n` +
        `${JSON.stringify({ type: "event" })}\n` +
        `${JSON.stringify(event)}`;
      void fetch(endpoint, { method: "POST", body: envelope });
    } catch {
      // Never let error reporting throw.
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#EAF3DE",
          color: "#173404",
        }}
      >
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, opacity: 0.8, marginBottom: 16 }}>
            The error has been logged. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              background: "#3B6D11",
              color: "white",
              border: 0,
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
