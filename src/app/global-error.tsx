"use client";

import { de } from "@/i18n/de";

/** Last-resort boundary (root layout failed). Own document, inline dark styles. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="de" style={{ colorScheme: "dark" }}>
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#09090b", color: "#fafafa", fontFamily: "system-ui, sans-serif" }}>
        <title>{de.errors.pageTitle}</title>
        <main role="alert" style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>{de.errors.pageTitle}</h1>
          <p style={{ color: "#a1a1aa" }}>{de.errors.pageText}</p>
          <button onClick={() => retry()} style={{ marginTop: 16, padding: "10px 16px", borderRadius: 12, border: 0, background: "#34d399", color: "#09090b", fontWeight: 600, cursor: "pointer" }}>
            {de.common.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
