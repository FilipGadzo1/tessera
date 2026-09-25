import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { cloneRender } from "./clone-render";

describe("cloneRender", () => {
  it("applies props onto the render element and keeps data-slot", async () => {
    const onClick = () => {};
    const el = cloneRender(
      <button type="button" />,
      { onClick, "aria-label": "Go" },
      {
        slot: "my-slot",
        className: "base",
      },
    );
    const screen = await render(el);
    const button = screen.getByRole("button");
    await expect.element(button).toHaveAttribute("data-slot", "my-slot");
    await expect.element(button).toHaveAttribute("aria-label", "Go");
  });

  it("lets the render element's own explicit props win over the passed props", async () => {
    const el = cloneRender(
      <button type="button" aria-label="mine" />,
      { "aria-label": "theirs" },
      {
        slot: "s",
        className: "base",
      },
    );
    const screen = await render(el);
    await expect.element(screen.getByRole("button")).toHaveAttribute("aria-label", "mine");
  });

  it("merges className, base first, with the render element's own className winning conflicts", async () => {
    const el = cloneRender(
      <button type="button" className="text-sm" />,
      {},
      {
        slot: "s",
        className: "text-lg flex",
      },
    );
    const screen = await render(el);
    // tailwind-merge: conflicting utility (text-*) from the render element wins; non-conflicting
    // base utilities are kept.
    await expect.element(screen.getByRole("button")).toHaveClass("flex", "text-sm");
  });

  it("keeps data-slot even though it is forced after the render element's own props", async () => {
    const el = cloneRender(
      <button type="button" data-slot="ignored" />,
      {},
      {
        slot: "forced",
        className: "",
      },
    );
    const screen = await render(el);
    await expect.element(screen.getByRole("button")).toHaveAttribute("data-slot", "forced");
  });

  it("applies overrideProps last, winning over both passed props and the render element's own", async () => {
    const el = cloneRender(
      <button type="button" onClick={() => {}} tabIndex={0} />,
      { onClick: () => {} },
      {
        slot: "s",
        className: "base",
        overrideProps: { onClick: undefined, tabIndex: -1 },
      },
    );
    const screen = await render(el);
    const button = screen.getByRole("button");
    await expect.element(button).toHaveAttribute("tabindex", "-1");
  });
});
