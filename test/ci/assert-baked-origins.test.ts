import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Tests for the guard the image smoke step runs inside the built artifact
 * (#189).
 *
 * The thing under test is a POSIX shell script, so it gets a shell and fixture
 * chunks rather than an import: the guard only ever reads text out of files, and
 * a fixture chunk says everything a real `.next/static` would — including the two
 * shapes the guard has to tell apart, which is the entire difficulty. Those are
 * the reason this file exists: the previous version of the guard assumed a `"`
 * was the only delimiter a bundle leaves around an inlined value, rejected a
 * correct bake, and stopped a release build. Nothing in `npm run check` could see
 * that, because the guard had no test.
 */

const GUARD = join(process.cwd(), ".github", "scripts", "assert-baked-origins.sh");

/** The origins `.github/workflows/build-image.yml` declares and bakes. */
const BACKEND = "https://api.lotp.xyz";
const SANDBOX = "https://sandbox.lotp.xyz";

interface GuardRun {
  /** 0 means "both origins arrive whole"; anything else is the guard refusing. */
  code: number;
  /** Whatever the guard printed, which is the part a maintainer reads. */
  out: string;
}

/** A built artifact as far as the guard can see one: chunk text under `.next/static`. */
function builtStatic(chunks: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "assert-baked-origins-"));
  mkdirSync(join(root, ".next", "static", "chunks"), { recursive: true });
  chunks.forEach((chunk, index) => {
    writeFileSync(join(root, ".next", "static", "chunks", `${index}.js`), chunk);
  });
  return root;
}

function runGuard(chunks: string[]): GuardRun {
  const root = builtStatic(chunks);
  try {
    const stdout = execFileSync("sh", [GUARD], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, WANT_BACKEND: BACKEND, WANT_SANDBOX: SANDBOX },
    });
    return { code: 0, out: stdout };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return {
      code: failure.status ?? 1,
      out: `${failure.stdout ?? ""}${failure.stderr ?? ""}`,
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** A correct bake, copied from what a real build actually emits: a quoted
 * default argument, an inlined option object, and template literals that append
 * a path and a query. The last two are the shapes #189 was about. */
const BAKED_WHOLE = [
  'function N({src:e="https://sandbox.lotp.xyz/sandbox/sample_1",mini:n}){return C("iframe",{src:e})}',
  'const client={baseUrl:"https://api.lotp.xyz"};async function A(e,t){let o=await fetch(`https://api.lotp.xyz${t}`,{method:e})}',
  'if(Y){Z({slug:Y,url:`https://sandbox.lotp.xyz/slides/${Y}?theme=${O}`})}let ee=null;let q="https://api.lotp.xyz/auth/login";',
];

describe("assert-baked-origins.sh (the baked-origin half of the image smoke step)", () => {
  it("accepts an origin baked whole, in a quote or in a template literal", () => {
    const run = runGuard(BAKED_WHOLE);
    expect(run.code).toBe(0);
    expect(run.out).toContain(`baked whole: ${BACKEND}`);
    expect(run.out).toContain(`baked whole: ${SANDBOX}`);
  });

  it("rejects two build args folded into one: the defect the guard exists for", () => {
    // What YAML folding `build-args:` into one line actually baked into the
    // first shipped image. A substring check passes on this.
    const run = runGuard([
      `const e="${BACKEND} NEXT_PUBLIC_SANDBOX_ORIGIN=${SANDBOX}",t=e+"/auth/login";`,
      `const s=\`${SANDBOX}/slides/\${id}\`;`,
    ]);
    expect(run.code).not.toBe(0);
    expect(run.out).toContain("has text appended to it");
    expect(run.out).toContain(`${BACKEND} NEXT_PUBLIC_SANDBOX_ORIGIN=`);
  });

  it("rejects a baked value with trailing whitespace, with nothing after it", () => {
    const run = runGuard([
      `const e="${BACKEND} ",s=\`${SANDBOX}/slides/\${id}\`;`,
    ]);
    expect(run.code).not.toBe(0);
    expect(run.out).toContain("has text appended to it");
  });

  it("rejects an origin that appears in the bundle only as mentioned text", () => {
    // Copy text is not a bake: the value never reached the artifact, and a
    // substring check would have reported this image as fine.
    const run = runGuard([
      `const copy="Ask anything and we build a deck at ${BACKEND}.";`,
      `const s=\`${SANDBOX}/slides/\${id}\`;`,
    ]);
    expect(run.code).not.toBe(0);
    expect(run.out).toContain("not baked into the image as a string literal");
  });

  it("does not reject copy text that mentions an origin beside a correct bake", () => {
    const run = runGuard([
      `const copy="Ask anything at ${BACKEND} and we build a deck.";`,
      ...BAKED_WHOLE,
    ]);
    expect(run.code).toBe(0);
  });

  it("says which literal it refused, not only that it refused", () => {
    const run = runGuard([
      `const e="${BACKEND} https://staging.lotp.xyz",s="${SANDBOX}";`,
    ]);
    expect(run.code).not.toBe(0);
    expect(run.out).toContain(`"${BACKEND} https://staging.lotp.xyz"`);
  });
});
