// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { VisualViewportMetrics } from "@/components/visual-viewport";
import { stubVisualViewport } from "@/test/test-utils";

function published() {
  const style = document.documentElement.style;
  return {
    height: style.getPropertyValue("--visual-viewport-height"),
    offsetTop: style.getPropertyValue("--visual-viewport-offset-top"),
  };
}

afterEach(() => {
  cleanup();
  document.documentElement.style.removeProperty("--visual-viewport-height");
  document.documentElement.style.removeProperty("--visual-viewport-offset-top");
});

describe("VisualViewportMetrics", () => {
  it("publishes the room on screen and renders nothing of its own", () => {
    const stub = stubVisualViewport({ innerHeight: 844, height: 844 });
    const { container } = render(<VisualViewportMetrics />);

    expect(container.firstChild).toBeNull();
    expect(published()).toEqual({ height: "844px", offsetTop: "0px" });

    stub.restore();
  });

  it("stops measuring when the shell unmounts", () => {
    const stub = stubVisualViewport({ innerHeight: 844, height: 844 });
    const { unmount } = render(<VisualViewportMetrics />);
    stub.resizeTo({ height: 514 });
    unmount();

    // Nothing is holding the measurement any more, so the measure stays where
    // the page left it rather than being driven from an unmounted shell.
    stub.resizeTo({ height: 700 });
    expect(published().height).toBe("514px");

    stub.restore();
  });
});
