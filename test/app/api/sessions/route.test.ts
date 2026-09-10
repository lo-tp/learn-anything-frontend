import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/sessions/route";

function post(paragraph: string): Promise<Response> {
  return POST(
    new Request("http://localhost/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paragraph }),
    }),
  );
}

describe("POST /api/sessions (dummy intake)", () => {
  it("answers narrow with canned feedback for a paragraph under 20 chars", async () => {
    const res = await post("Too short.");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verdict).toBe("narrow");
    expect(typeof body.feedback).toBe("string");
    expect(body.feedback.length).toBeGreaterThan(0);
  });

  it("accepts a long paragraph and labels the session with the first ~60 chars", async () => {
    const paragraph = "I want to master Newton's second law of motion, and I already know what velocity means but I keep mixing up force and momentum.",
      // 127 chars — the label must be its first 60 chars exactly.
      expectedLabel = "I want to master Newton's second law of motion, and I alread";
    const res = await post(paragraph);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verdict).toBe("accept_target");
    expect(body.knowledgePoint).toBe(expectedLabel);
    expect(typeof body.sessionId).toBe("string");
    expect(body.sessionId.length).toBeGreaterThan(0);
  });

  it("keeps a short knowledge point label untouched when it is under 60 chars", async () => {
    const paragraph = "Newton's second law of motion";
    const res = await post(paragraph);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      verdict: "accept_target",
      knowledgePoint: paragraph,
    });
  });

  it("rejects an empty paragraph with 400", async () => {
    const res = await post("   ");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBeTruthy();
  });

  it("rejects a paragraph over 2000 chars with 400", async () => {
    const res = await post("x".repeat(2001));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBeTruthy();
  });

  it("records an accepted intake as a probing session on top of the History", async () => {
    const paragraph = "Quantum entanglement basics for a classical programmer";
    const res = await post(paragraph);
    expect(res.status).toBe(200);

    const list = await (await GET()).json();
    expect(list[0]).toMatchObject({
      knowledgePoint: paragraph,
      stage: "probing",
    });
  });
});
