// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  DropdownMenu as DropdownMenuRoot,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function Menu() {
  return (
    <DropdownMenuRoot>
      <DropdownMenuTrigger>Open</DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent>
          <DropdownMenuLabel>Label</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem>Plain item</DropdownMenuItem>
            <DropdownMenuItem inset>Inset item</DropdownMenuItem>
            <DropdownMenuItem variant="destructive">
              Delete
              <DropdownMenuShortcut>⌫</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuCheckboxItem checked>
              Checkbox item
            </DropdownMenuCheckboxItem>
            <DropdownMenuRadioGroup>
              <DropdownMenuRadioItem value="a">Radio A</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="b" inset>Radio B</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Sub</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Sub item</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  );
}

function openMenu() {
  render(<Menu />);
  fireEvent.pointerDown(screen.getByRole("button", { name: "Open" }), {
    button: 0,
  });
}

afterEach(() => {
  cleanup();
});

describe("DropdownMenu", () => {
  it("renders the full structure: label, separator, group, items, checkbox, radios", () => {
    openMenu();

    expect(screen.getByRole("menu")).toBeTruthy();
    expect(screen.getByText("Label")).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Plain item" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Inset item" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /Delete/ })).toBeTruthy();
    expect(screen.getByText("⌫")).toBeTruthy();
    expect(screen.getByText("Checkbox item")).toBeTruthy();
    expect(screen.getByText("Radio A")).toBeTruthy();
    expect(screen.getByText("Radio B")).toBeTruthy();
  });

  it("marks items with data-slot, data-variant, and data-inset", () => {
    openMenu();

    const menu = screen.getByRole("menu");
    const plain = screen.getByRole("menuitem", { name: "Plain item" });
    expect(plain.dataset.slot).toBe("dropdown-menu-item");
    expect(plain.dataset.variant).toBe("default");

    const destructive = screen.getByRole("menuitem", { name: /Delete/ });
    expect(destructive.dataset.variant).toBe("destructive");

    const inset = screen.getByRole("menuitem", { name: "Inset item" });
    expect(inset.dataset.inset).toBe("true");

    expect(
      menu.querySelector('[data-slot="dropdown-menu-label"]'),
    ).toBeTruthy();
    expect(
      menu.querySelector('[data-slot="dropdown-menu-separator"]'),
    ).toBeTruthy();
    expect(
      menu.querySelector('[data-slot="dropdown-menu-group"]'),
    ).toBeTruthy();
    expect(
      menu.querySelector('[data-slot="dropdown-menu-checkbox-item"]'),
    ).toBeTruthy();
    expect(
      menu.querySelector('[data-slot="dropdown-menu-radio-item"]'),
    ).toBeTruthy();
  });

  it("opens a sub-menu with ArrowRight and renders its content", () => {
    openMenu();

    const subTrigger = screen.getByRole("menuitem", { name: "Sub" });
    fireEvent.keyDown(subTrigger, { key: "ArrowRight" });

    expect(screen.getByText("Sub item")).toBeTruthy();
  });
});
