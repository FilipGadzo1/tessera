import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "./index";

/** A 1×1 PNG. */
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
/** Not a decodable image, so the load fails. */
const BROKEN = "data:image/png;base64,bm90LWFuLWltYWdl";

describe("Avatar", () => {
  it("shows the image once it has loaded, and hides the fallback", async () => {
    const screen = await render(
      <Avatar data-testid="avatar">
        <AvatarImage src={PNG} alt="Ada Lovelace" />
        <AvatarFallback>al</AvatarFallback>
      </Avatar>,
    );
    const img = screen.getByRole("img", { name: "Ada Lovelace" });
    await expect.element(img).toBeInTheDocument();
    await expect.element(img).toHaveAttribute("data-slot", "avatar-image");
    await expect.element(img).toHaveClass("size-full", "object-cover");
    await expect.element(screen.getByText("al")).not.toBeInTheDocument();
    const root = screen.getByTestId("avatar").element();
    expect(root.getAttribute("data-slot")).toBe("avatar");
    expect(root.getAttribute("data-size")).toBe("md");
    for (const cls of ["size-10", "rounded-full", "bg-muted", "overflow-hidden"]) {
      expect(root.classList).toContain(cls);
    }
  });

  it("shows the fallback when the image fails, with uppercase initials", async () => {
    const screen = await render(
      <Avatar>
        <AvatarImage src={BROKEN} alt="Grace Hopper" />
        <AvatarFallback>gh</AvatarFallback>
      </Avatar>,
    );
    const fallback = screen.getByText("gh");
    await expect.element(fallback).toBeInTheDocument();
    await expect.element(fallback).toHaveAttribute("data-slot", "avatar-fallback");
    expect(getComputedStyle(fallback.element()).textTransform).toBe("uppercase");
    expect(fallback.element().classList).toContain("text-sm");
    await expect.element(screen.getByRole("img")).not.toBeInTheDocument();
  });

  it("waits for `delay` before showing the fallback", async () => {
    const start = performance.now();
    const screen = await render(
      <Avatar>
        <AvatarFallback delay={300}>LT</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByText("LT").query()).toBeNull();
    await expect.element(screen.getByText("LT"), { timeout: 2000 }).toBeInTheDocument();
    expect(performance.now() - start).toBeGreaterThanOrEqual(250);
  });

  it.each([
    ["sm", "size-8", 32],
    ["md", "size-10", 40],
    ["lg", "size-12", 48],
  ] as const)("applies the %s size", async (size, cls, px) => {
    const screen = await render(
      <Avatar data-testid="avatar" size={size}>
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>,
    );
    const root = screen.getByTestId("avatar").element();
    expect(root.getAttribute("data-size")).toBe(size);
    expect(root.classList).toContain(cls);
    expect(root.getBoundingClientRect().width).toBe(px);
    const fallback = screen.getByText("AB").element();
    expect(fallback.classList).toContain(size === "sm" ? "text-xs" : "text-sm");
    expect(fallback.classList).not.toContain(size === "sm" ? "text-sm" : "text-xs");
  });

  it("uses the muted tokens and follows .dark", async () => {
    const screen = await render(
      <div>
        <Avatar data-testid="avatar">
          <AvatarFallback>CD</AvatarFallback>
        </Avatar>
        <div data-testid="ref" className="bg-muted text-muted-foreground" />
      </div>,
    );
    const root = screen.getByTestId("avatar").element();
    const ref = screen.getByTestId("ref").element();
    const fallback = screen.getByText("CD").element();
    const lightBg = getComputedStyle(ref).backgroundColor;
    expect(getComputedStyle(root).backgroundColor).toBe(lightBg);
    expect(getComputedStyle(fallback).color).toBe(getComputedStyle(ref).color);
    document.documentElement.classList.add("dark");
    try {
      const darkBg = getComputedStyle(ref).backgroundColor;
      expect(darkBg).not.toBe(lightBg);
      expect(getComputedStyle(root).backgroundColor).toBe(darkBg);
    } finally {
      document.documentElement.classList.remove("dark");
    }
  });

  it("merges className on every part", async () => {
    const screen = await render(
      <Avatar data-testid="avatar" className="rounded-md">
        <AvatarImage src={PNG} alt="Ada" className="object-contain" />
        <AvatarFallback className="text-base">EF</AvatarFallback>
      </Avatar>,
    );
    const root = screen.getByTestId("avatar").element();
    expect(root.classList).toContain("rounded-md");
    expect(root.classList).not.toContain("rounded-full");
    const img = screen.getByRole("img", { name: "Ada" });
    await expect.element(img).toHaveClass("object-contain");
    await expect.element(img).not.toHaveClass("object-cover");
  });

  it("merges className on the fallback", async () => {
    const screen = await render(
      <Avatar>
        <AvatarFallback className="text-base">EF</AvatarFallback>
      </Avatar>,
    );
    const fallback = screen.getByText("EF").element();
    expect(fallback.classList).toContain("text-base");
    expect(fallback.classList).not.toContain("text-sm");
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    const screen = await render(
      <div className={theme === "dark" ? "dark bg-background p-4" : "bg-background p-4"}>
        <Avatar>
          <AvatarImage src={PNG} alt="Ada Lovelace" />
          <AvatarFallback>AL</AvatarFallback>
        </Avatar>
        {(["sm", "md", "lg"] as const).map((size) => (
          <Avatar key={size} size={size}>
            <AvatarFallback>GH</AvatarFallback>
          </Avatar>
        ))}
        <AvatarGroup>
          <Avatar>
            <AvatarFallback>AL</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>GH</AvatarFallback>
          </Avatar>
        </AvatarGroup>
      </div>,
    );
    await expect.element(screen.getByRole("img", { name: "Ada Lovelace" })).toBeInTheDocument();
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});

describe("AvatarGroup", () => {
  it("overlaps its avatars with a background ring", async () => {
    const screen = await render(
      <div>
        <AvatarGroup data-testid="group" aria-label="Team">
          <Avatar data-testid="first">
            <AvatarFallback>AL</AvatarFallback>
          </Avatar>
          <Avatar data-testid="second">
            <AvatarFallback>GH</AvatarFallback>
          </Avatar>
        </AvatarGroup>
        <div data-testid="ref" className="ring-2 ring-background" />
      </div>,
    );
    const group = screen.getByTestId("group").element();
    expect(group.getAttribute("data-slot")).toBe("avatar-group");
    expect(group.getAttribute("aria-label")).toBe("Team");
    for (const cls of ["flex", "-space-x-2"]) expect(group.classList).toContain(cls);
    const first = screen.getByTestId("first").element().getBoundingClientRect();
    const second = screen.getByTestId("second").element().getBoundingClientRect();
    expect(second.left - first.right).toBe(-8);
    const refShadow = getComputedStyle(screen.getByTestId("ref").element()).boxShadow;
    expect(refShadow).not.toBe("none");
    expect(getComputedStyle(screen.getByTestId("second").element()).boxShadow).toBe(refShadow);
  });

  it("passes through props and merges className", async () => {
    const screen = await render(<AvatarGroup data-testid="group" className="-space-x-4" />);
    const group = screen.getByTestId("group").element();
    expect(group.classList).toContain("-space-x-4");
    expect(group.classList).not.toContain("-space-x-2");
  });
});
