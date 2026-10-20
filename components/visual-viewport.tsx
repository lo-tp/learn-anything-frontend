"use client";

import { useEffect } from "react";
import { startVisualViewport } from "@/lib/visual-viewport";

/**
 * The shell's own measure (#230).
 *
 * `<body>` is sized from `--visual-viewport-height` and pinned at
 * `--visual-viewport-offset-top`, and the TopBar and every sheet are pinned from
 * the same two values. Those properties are only true while something is
 * measuring the room on screen. This renders nothing: it holds the measurement
 * for the life of the page, so every surface that reads the measure — the frame,
 * the sheet primitive, a view's own scroll — reads the same numbers.
 *
 * Mounted once, in the root layout, beside the pre-paint theme script: the
 * measure belongs to the shell, and the shell is what the layout renders.
 */
export function VisualViewportMetrics() {
  useEffect(() => startVisualViewport(), []);
  return null;
}
