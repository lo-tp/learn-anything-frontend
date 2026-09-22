// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";
import { TopBarTabs } from "@/components/top-bar-tabs";

afterEach(() => {
  cleanup();
});

describe("TopBarTabs", () => {
  it("renders the three tabs from the top-bar design", () => {
    renderWithLocale(<TopBarTabs />);
    expect(screen.getByRole("button", { name: "Project" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "History" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Export" })).toBeTruthy();
  });

  it("marks the first tab active by default", () => {
    renderWithLocale(<TopBarTabs />);
    expect(
      screen.getByRole("button", { name: "Project" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen.getByRole("button", { name: "History" }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("moves the active tab when a tab is clicked", () => {
    renderWithLocale(<TopBarTabs />);
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    expect(
      screen.getByRole("button", { name: "History" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen.getByRole("button", { name: "Project" }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("labels the tabs from the zh catalog under the zh locale", () => {
    renderWithLocale(<TopBarTabs />, { locale: "zh" });
    expect(screen.getByRole("button", { name: "项目" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "历史" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "导出" })).toBeTruthy();
  });
});
