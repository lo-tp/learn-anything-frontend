import { useState } from "react";

/**
 * Sample demo — a hand-inserted demo for the stub era (#37).
 *
 * This is the shape every LLM-authored Demo must take (ADR 0007): a default
 * export component accepting a `part: number` prop. Part switching
 * re-renders without remount, so hook state survives.
 *
 * Served as `/demos/sample/bundle.js` (built by scripts/build-demos.mjs) —
 * the on-disk stand-in for the `session_messages.demo_js` row, which lands
 * with the schema columns.
 */
export default function Sample({ part }: { part: number }) {
  const [count, setCount] = useState(0);
  const [step, setStep] = useState(1);

  const btn = {
    padding: "8px 16px",
    fontSize: 15,
    cursor: "pointer",
    border: "1px solid #999",
    borderRadius: 6,
    background: "#fff",
  };

  if (part >= 1) {
    return (
      <section
        style={{ padding: 16, fontFamily: "system-ui, sans-serif", lineHeight: 1.5 }}
      >
        <h2 style={{ marginTop: 0 }}>How this demo works</h2>
        <p>
          This component runs in an opaque-origin sandbox: it has no cookies,
          no storage, no access to the page around it. Everything it shows is
          its own state.
        </p>
        <p>
          <strong>count = {count}</strong> — switching parts re-renders this
          component without remounting it, so the counter you built in part 1
          is still here.
        </p>
      </section>
    );
  }

  return (
    <section
      style={{ padding: 16, fontFamily: "system-ui, sans-serif", lineHeight: 1.5 }}
    >
      <p style={{ marginTop: 0 }}>
        A tiny interactive demo, raw TSX compiled to a module at write time:
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button style={btn} onClick={() => setCount((c) => c + step)}>
          count = {count}
        </button>
        <button style={btn} onClick={() => setStep((s) => s + 1)}>
          step +{step}
        </button>
      </div>
      <p>
        Switch to part 2 and back — the counter keeps its state (re-render,
        no remount).
      </p>
    </section>
  );
}
