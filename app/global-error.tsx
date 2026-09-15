"use client";
import he from "@/messages/he.json";

/** Last-resort boundary when the root layout itself fails; no providers are available here. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = he.errors;
  return (
    <html lang="he" dir="rtl">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1.5rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>{t.page_title}</h1>
        <p style={{ color: "#555", marginTop: ".5rem" }}>{t.page_body}</p>
        {error.digest ? (
          <p style={{ color: "#777", fontSize: ".8rem", marginTop: ".5rem" }}>
            {t.error_code}: <code dir="ltr">{error.digest}</code>
          </p>
        ) : null}
        <button type="button" onClick={() => reset()} style={{ marginTop: "1.5rem", padding: ".5rem 1rem", cursor: "pointer" }}>
          {t.retry}
        </button>
      </body>
    </html>
  );
}
