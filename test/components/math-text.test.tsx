// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { MathText } from "@/components/math-text";

// jsdom's MathML-namespaced elements (created via createElementNS) have no
// `.style` property, but temml sets `node.style.display` for display-mode
// math. Polyfill a plain style object so display mode can be exercised.
type CreatElNS = (ns: string, name: string) => Element;
type MaybeStyled = { style?: unknown };
const doc = document as unknown as { createElementNS: CreatElNS };
const origCreateElementNS = doc.createElementNS.bind(document);
doc.createElementNS = (ns, name) => {
  const el = origCreateElementNS(ns, name);
  if ((el as MaybeStyled).style === undefined) {
    Object.defineProperty(el, "style", { value: {} });
  }
  return el;
};

afterEach(() => {
  cleanup();
});

describe("MathText", () => {
  it("renders plain text unchanged, with no <math> element", () => {
    const { container } = render(<MathText content="Just a word." />);
    expect(container.querySelectorAll("math").length).toBe(0);
    expect(container.textContent).toBe("Just a word.");
  });

  it("renders inline $…$ as MathML, preserving surrounding text", () => {
    const { container } = render(<MathText content="If $a=b$ then ok" />);
    expect(container.querySelectorAll("math").length).toBe(1);
    expect(container.textContent).toContain("If");
    expect(container.textContent).toContain("then ok");
  });

  it("renders display $$…$$ as a <math> element", () => {
    const { container } = render(<MathText content="$$a^2+b^2=c^2$$" />);
    const math = container.querySelector("math");
    expect(math).not.toBeNull();
    expect(math!.textContent).toContain("a");
  });

  it("re-renders when content changes", () => {
    const { container, rerender } = render(<MathText content="$x$" />);
    expect(container.querySelectorAll("math").length).toBe(1);
    rerender(<MathText content="no math" />);
    expect(container.querySelectorAll("math").length).toBe(0);
    expect(container.textContent).toBe("no math");
  });

  it("does not inject HTML from content (XSS safety)", () => {
    const { container } = render(<MathText content="<b>bold</b> $a$" />);
    // The tag must stay literal text, not become a <b> element.
    expect(container.querySelectorAll("b").length).toBe(0);
    expect(container.textContent).toContain("<b>bold</b>");
    // The math still renders.
    expect(container.querySelectorAll("math").length).toBe(1);
  });

  it("renders nothing for empty content", () => {
    const { container } = render(<MathText content="" />);
    expect(container.querySelectorAll("math").length).toBe(0);
    expect(container.textContent).toBe("");
  });
});
