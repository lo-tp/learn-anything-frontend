"use client";

/**
 * `/demo-sandbox` — a dev showcase host for the sample demo (#37).
 *
 * The minimal host side of the ADR 0007 protocol around
 * `<iframe sandbox="allow-scripts" src="/demos/sample">`: part stepper
 * (parent → sandbox `DEMO_SET_PART`), auto-height (sandbox → parent
 * `SANDBOX_RESIZE`, clamped), error banner (sandbox → parent
 * `SANDBOX_ERROR`), and a small protocol log so the channel is visible.
 *
 * Receipts are validated on `event.origin === "null"` (the opaque origin's
 * serialization) and field-by-field — never trusted wholesale. Append `?auto=1`
 * to auto-step through the parts (used by the headless e2e check).
 */
import { type CSSProperties, useEffect, useRef, useState } from "react";

const SLUG = "sample";
// Roomy canvas: the sample is a slide deck (up to 1000×700), so the
// sandbox never shrinks below presentation size; SANDBOX_RESIZE can only
// grow it further, up to MAX_HEIGHT.
const MIN_HEIGHT = 720;
const MAX_HEIGHT = 1200;

export default function DemoSandboxPage() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(720);
  const [error, setError] = useState<string | null>(null);
  const [part, setPart] = useState(0);
  const [log, setLog] = useState<string[]>([]);

  const say = (line: string) =>
    setLog((l) => [...l.slice(-19), `${new Date().toISOString().slice(11, 19)} ${line}`]);

  // Sandbox → parent: validate origin and shape on receipt.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== "null") return; // only the opaque-origin sandbox
      const d = event.data as { type?: unknown; height?: unknown; message?: unknown } | null;
      if (d && d.type === "SANDBOX_RESIZE" && Number.isFinite(d.height)) {
        setHeight(Math.min(Math.max(d.height as number, MIN_HEIGHT), MAX_HEIGHT));
        say(`← SANDBOX_RESIZE height=${Math.round(d.height as number)}`);
      } else if (d && d.type === "SANDBOX_ERROR" && typeof d.message === "string") {
        setError(d.message);
        say(`← SANDBOX_ERROR ${d.message}`);
      }
    };
    addEventListener("message", onMessage);
    return () => removeEventListener("message", onMessage);
  }, []);

  // ?auto=1 — step through the parts so headless checks can watch the log.
  useEffect(() => {
    if (!window.location.search.includes("auto=1")) return;
    const t1 = setTimeout(() => goPart(1), 2500);
    const t2 = setTimeout(() => goPart(0), 5000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Parent → sandbox: the only outbound message, targetOrigin "*" (the app
  // origin is unknowable to the sandbox; delivery safety is field checks at
  // the receiver, per ADR 0007).
  function goPart(p: number) {
    setPart(p);
    frameRef.current?.contentWindow?.postMessage({ type: "DEMO_SET_PART", part: p }, "*");
    say(`→ DEMO_SET_PART {part: ${p}}`);
  }

  const btn: CSSProperties = {
    padding: "6px 14px",
    fontSize: 14,
    cursor: "pointer",
    border: "1px solid #888",
    borderRadius: 6,
    background: part === 0 ? "#2563eb" : "#fff",
    color: part === 0 ? "#fff" : "inherit",
  };
  const btn2: React.CSSProperties = { ...btn, background: part === 1 ? "#2563eb" : "#fff", color: part === 1 ? "#fff" : "inherit" };

  return (
    <main style={{ maxWidth: 1200, margin: "24px auto", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20 }}>Demo sandbox — sample</h1>
      <p style={{ fontSize: 14, opacity: 0.7 }}>
        LLM-shaped demo TSX → esbuild → <code>/demos/sample/bundle.js</code> →
        <code> &lt;iframe sandbox=&quot;allow-scripts&quot;&gt; </code> (opaque origin).
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <button style={btn} onClick={() => goPart(0)}>Part 1 — counter</button>
        <button style={btn2} onClick={() => goPart(1)}>Part 2 — how it works</button>
        <span style={{ fontSize: 13, opacity: 0.6 }}>height: {height}px</span>
      </div>
      {error && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 14px",
            background: "#fef2f2",
            border: "1px solid #dc2626",
            color: "#991b1b",
            borderRadius: 6,
            fontSize: 14,
          }}
        >
          SANDBOX_ERROR: {error}
        </div>
      )}
      <iframe
        ref={frameRef}
        sandbox="allow-scripts"
        src={`/demos/${SLUG}`}
        title="sample demo sandbox"
        style={{
          width: "100%",
          height,
          border: "1px solid #bbb",
          borderRadius: 6,
          background: "#fff",
          display: "block",
        }}
      />
      <pre
        style={{
          marginTop: 12,
          padding: "10px 14px",
          background: "#1e293b",
          color: "#a7f3d0",
          font: "12px/1.6 ui-monospace, monospace",
          borderRadius: 6,
          maxHeight: 180,
          overflowY: "auto",
          whiteSpace: "pre-wrap",
        }}
      >
        {log.join("\n") || "(no protocol messages yet)"}
      </pre>
    </main>
  );
}
