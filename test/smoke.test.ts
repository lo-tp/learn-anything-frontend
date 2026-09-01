import { describe, expect, it } from "vitest";
import * as contracts from "../core/contracts";
import * as llm from "../core/llm";
import * as markdown from "../core/markdown";
import * as session from "../core/session";
import * as store from "../core/store";

describe("core layer", () => {
  it("loads all five core modules", () => {
    expect(session).toBeDefined();
    expect(contracts).toBeDefined();
    expect(llm).toBeDefined();
    expect(store).toBeDefined();
    expect(markdown).toBeDefined();
  });
});
