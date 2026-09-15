"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#F4F6F7" }}>
        <div style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          textAlign: "center",
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "#FBE3E1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
            fontSize: 24,
          }}>
            ⚠️
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#14242B", margin: "0 0 8px" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: "#5C6E76", maxWidth: 300, margin: "0 0 24px", lineHeight: 1.5 }}>
            PPMS encountered a critical error. Please refresh the page or contact support.
          </p>
          <button
            onClick={reset}
            style={{
              background: "#157A73",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              minHeight: 44,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
