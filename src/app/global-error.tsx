"use client";

import { useEffect } from "react";

/**
 * Replaces the root layout when it fails, so it must ship its own <html>/<body>
 * and cannot rely on global styles being applied.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[global error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fafafa",
          color: "#18181b",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          padding: "24px",
        }}
      >
        <title>Something went wrong</title>
        <div
          style={{
            maxWidth: "28rem",
            width: "100%",
            textAlign: "center",
            border: "1px solid #e4e4e7",
            borderRadius: "16px",
            background: "#ffffff",
            padding: "32px",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
            The app couldn’t start
          </h1>
          <p style={{ marginTop: "8px", fontSize: "0.875rem", color: "#52525b" }}>
            Reload to try again. If this keeps happening, contact a tournament director.
          </p>
          {error.digest ? (
            <p style={{ marginTop: "12px", fontSize: "0.75rem", color: "#a1a1aa" }}>
              Reference {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: "24px",
              borderRadius: "8px",
              border: "none",
              background: "#18181b",
              color: "#ffffff",
              padding: "10px 16px",
              fontSize: "0.875rem",
              fontWeight: 500,
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
