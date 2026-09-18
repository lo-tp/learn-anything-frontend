// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { SandboxFrame } from "@/components/sandbox/sandbox-frame";

const SRC = "http://localhost:3001/slides/slide-1";

afterEach(() => {
  cleanup();
});

function frame(container: HTMLElement): HTMLIFrameElement {
  const el = container.querySelector("iframe");
  if (!el) throw new Error("expected an <iframe>");
  return el;
}

describe("SandboxFrame", () => {
  it("renders the main frame: titled, sandboxed, focusable, eagerly loaded", () => {
    const { container } = render(<SandboxFrame src={SRC} />);
    const el = frame(container);
    expect(el.getAttribute("src")).toBe(SRC);
    expect(el.getAttribute("title")).toBe("Sandbox");
    expect(el.getAttribute("sandbox")).toBe("allow-scripts allow-same-origin");
    // Not a decorative preview: announced, focusable, not lazy.
    expect(el.getAttribute("aria-hidden")).toBeNull();
    expect(el.getAttribute("tabindex")).toBeNull();
    expect(el.getAttribute("loading")).toBeNull();
  });

  it("renders mini as a decorative, unfocusable, lazy preview (no title)", () => {
    const { container } = render(<SandboxFrame src={SRC} mini />);
    const el = frame(container);
    expect(el.getAttribute("title")).toBeNull();
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.getAttribute("tabindex")).toBe("-1");
    expect(el.getAttribute("loading")).toBe("lazy");
    expect(el.getAttribute("sandbox")).toBe("allow-scripts allow-same-origin");
  });

  it("merges a caller className after the base sizing", () => {
    const { container } = render(<SandboxFrame src={SRC} className="absolute" />);
    const cls = frame(container).getAttribute("class") ?? "";
    expect(cls).toContain("h-full");
    expect(cls).toContain("absolute");
  });

  it("forwards onLoad to the iframe", () => {
    const onLoad = vi.fn();
    const { container } = render(<SandboxFrame src={SRC} onLoad={onLoad} />);
    fireEvent.load(frame(container));
    expect(onLoad).toHaveBeenCalledTimes(1);
  });
});
