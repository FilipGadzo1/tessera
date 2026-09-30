import axe from "axe-core";
import { type ReactElement, type ReactNode, useState } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { emulateForcedColors, emulateReducedMotion, systemColor } from "../../../test/emulation";
import { Tree, TreeItem, TreeItemContent, TreeItemIcon, type TreeProps } from "./tree";
import * as stories from "./tree.stories";

/**
 * The fixture tree (every folder collapsed unless a test expands it):
 *
 *   src
 *     components
 *       button.tsx
 *       card.tsx
 *     index.ts
 *   docs
 *     readme.md
 *   package.json
 */
function Leaf({ value, disabled }: { value: string; disabled?: boolean }) {
  return (
    <TreeItem value={value} disabled={disabled}>
      <TreeItemContent>{value}</TreeItemContent>
    </TreeItem>
  );
}

function Files({ extra, ...props }: Partial<TreeProps> & { extra?: ReactNode }) {
  return (
    <Tree aria-label="Files" {...props}>
      <TreeItem value="src">
        <TreeItemContent>src</TreeItemContent>
        <TreeItem value="components">
          <TreeItemContent>components</TreeItemContent>
          <Leaf value="button.tsx" />
          <Leaf value="card.tsx" />
        </TreeItem>
        <Leaf value="index.ts" />
      </TreeItem>
      <TreeItem value="docs">
        <TreeItemContent>docs</TreeItemContent>
        <Leaf value="readme.md" />
      </TreeItem>
      <Leaf value="package.json" />
      {extra}
    </Tree>
  );
}

/** Renders a story with the meta's args under its own, through its render (or the meta's). */
function StoryView({ story }: { story: { args?: object; render?: unknown } }) {
  const Render = (story.render ?? stories.default.render) as (args: object) => ReactElement;
  return <Render {...stories.default.args} {...story.args} />;
}

const tree = () => page.getByRole("tree").element() as HTMLElement;
const item = (name: string) =>
  page.getByRole("treeitem", { name, exact: true }).element() as HTMLElement;
const rowOf = (element: Element) =>
  element.querySelector<HTMLElement>(":scope > [data-slot=tree-item-content]") as HTMLElement;
const nameOf = (element: Element | null) =>
  element ? rowOf(element)?.textContent?.trim() : undefined;
const focused = () => nameOf(document.activeElement);
/** Items inside a collapsed (hidden) group are mounted but not rendered. */
const visible = (element: Element) => element.checkVisibility();
const visibleNames = () =>
  Array.from(tree().querySelectorAll("[role=treeitem]"))
    .filter(visible)
    .map((element) => nameOf(element));
const tabbable = () =>
  Array.from(tree().querySelectorAll<HTMLElement>("[role=treeitem]"))
    .filter((element) => element.tabIndex === 0)
    .map((element) => nameOf(element));
const selectedNames = () =>
  Array.from(tree().querySelectorAll("[role=treeitem][aria-selected=true]"))
    .filter(visible)
    .map((element) => nameOf(element));
/** [aria-level, aria-posinset, aria-setsize] */
const positionOf = (element: Element) =>
  ["aria-level", "aria-posinset", "aria-setsize"].map((name) => Number(element.getAttribute(name)));

/** Presses one key and waits until focus lands on `name`. */
async function press(key: string, name?: string) {
  await userEvent.keyboard(key);
  if (name !== undefined) await expect.poll(focused).toBe(name);
}

/** Tabs into the tree and waits until focus is on its tabbable item. */
async function tabIn(name: string) {
  await userEvent.tab();
  await expect.poll(focused).toBe(name);
}

afterEach(() => {
  document.documentElement.classList.remove("dark");
  vi.useRealTimers();
});

describe("Tree", () => {
  describe("structure", () => {
    it("renders a tree of treeitems over groups, with a data-slot on every part", async () => {
      await render(<Files defaultExpandedValues={["src"]} />);
      const root = tree();
      expect(root.tagName).toBe("UL");
      expect(root.dataset.slot).toBe("tree");
      expect(root.getAttribute("aria-label")).toBe("Files");
      expect(root.hasAttribute("aria-multiselectable")).toBe(false);
      const src = item("src");
      expect(src.tagName).toBe("LI");
      expect(src.dataset.slot).toBe("tree-item");
      const group = src.querySelector(":scope > ul");
      expect(group?.getAttribute("role")).toBe("group");
      expect(group?.getAttribute("data-slot")).toBe("tree-group");
      expect(rowOf(src).tagName).toBe("DIV");
      expect(src.querySelector("[data-slot=tree-item-chevron]")?.getAttribute("aria-hidden")).toBe(
        "true",
      );
    });

    it("renders TreeItemIcon as a hidden slot inside the row", async () => {
      await render(
        <Tree aria-label="Files">
          <TreeItem value="a">
            <TreeItemContent>
              <TreeItemIcon>
                <svg />
              </TreeItemIcon>
              a.txt
            </TreeItemContent>
          </TreeItem>
        </Tree>,
      );
      const icon = rowOf(item("a.txt")).querySelector("[data-slot=tree-item-icon]");
      expect(icon?.getAttribute("aria-hidden")).toBe("true");
    });

    it("keeps collapsed children mounted in a hidden group", async () => {
      await render(<Files />);
      expect(visibleNames()).toEqual(["src", "docs", "package.json"]);
      const group = item("src").querySelector(":scope > ul") as HTMLElement;
      expect(group.hidden).toBe(true);
      expect(getComputedStyle(group).display).toBe("none");
      // components (with button.tsx and card.tsx) and index.ts.
      expect(group.querySelectorAll("[role=treeitem]")).toHaveLength(4);
    });

    it("counts positions from the rendered items in the FileTree story's composition", async () => {
      await render(<StoryView story={stories.FileTree} />);
      // The story renders <Tree><FileTreeItems /></Tree>: one element child, four items.
      await expect.poll(() => positionOf(item("package.json"))).toEqual([1, 3, 4]);
      expect(positionOf(item("src"))).toEqual([1, 1, 4]);
      expect(positionOf(item("docs"))).toEqual([1, 2, 4]);
      expect(positionOf(item("tsconfig.json"))).toEqual([1, 4, 4]);
      expect(positionOf(item("components"))).toEqual([2, 1, 3]);
      expect(positionOf(item("index.ts"))).toEqual([2, 3, 3]);
      expect(positionOf(item("tree.tsx"))).toEqual([3, 3, 3]);
      expect(tabbable()).toEqual(["src"]);
    });

    it("counts the items of a fragment-returning wrapper, and a child rendering null", async () => {
      function Pair({ a, b }: { a: string; b: string }) {
        return (
          <>
            <Leaf value={a} />
            <Leaf value={b} />
          </>
        );
      }
      function Nothing() {
        return null;
      }
      await render(
        <Tree aria-label="Files" defaultExpandedValues={["empty", "folder"]}>
          <Pair a="a.txt" b="b.txt" />
          <TreeItem value="empty">
            <TreeItemContent>empty</TreeItemContent>
            <Nothing />
          </TreeItem>
          <TreeItem value="folder">
            <TreeItemContent>folder</TreeItemContent>
            <Nothing />
            <Pair a="c.txt" b="d.txt" />
          </TreeItem>
          <Nothing />
        </Tree>,
      );
      await expect.poll(() => positionOf(item("a.txt"))).toEqual([1, 1, 4]);
      expect(positionOf(item("b.txt"))).toEqual([1, 2, 4]);
      expect(positionOf(item("empty"))).toEqual([1, 3, 4]);
      expect(positionOf(item("folder"))).toEqual([1, 4, 4]);
      expect(positionOf(item("c.txt"))).toEqual([2, 1, 2]);
      expect(positionOf(item("d.txt"))).toEqual([2, 2, 2]);
      // A child that renders nothing does not make a parent.
      const empty = item("empty");
      await expect.poll(() => empty.hasAttribute("aria-expanded")).toBe(false);
      expect(empty.querySelector("[data-slot=tree-item-chevron]")).toBeNull();
      expect(empty.querySelector("[data-slot=tree-item-spacer]")).not.toBeNull();
      expect(visibleNames()).toEqual(["a.txt", "b.txt", "empty", "folder", "c.txt", "d.txt"]);
      expect(item("folder").getAttribute("aria-expanded")).toBe("true");
    });

    it("a re-render that moves no item writes no position attributes", async () => {
      const screen = await render(<Files defaultExpandedValues={["src"]} className="w-60" />);
      await expect.poll(() => positionOf(item("index.ts"))).toEqual([2, 2, 2]);
      const writes: string[] = [];
      const observer = new MutationObserver((records) => {
        for (const record of records) writes.push(record.attributeName ?? "");
      });
      observer.observe(tree(), {
        subtree: true,
        attributeFilter: ["aria-posinset", "aria-setsize"],
      });
      await screen.rerender(<Files defaultExpandedValues={["src"]} className="w-64" />);
      await expect.poll(() => tree().classList.contains("w-64")).toBe(true);
      for (const record of observer.takeRecords()) writes.push(record.attributeName ?? "");
      observer.disconnect();
      expect(writes).toEqual([]);
      expect(positionOf(item("index.ts"))).toEqual([2, 2, 2]);
    });

    it("renders a tab stop and positions in server HTML", async () => {
      const html = renderToString(<Files defaultExpandedValues={["src"]} />);
      const container = document.createElement("div");
      container.innerHTML = html;
      const items = Array.from(container.querySelectorAll<HTMLElement>("[role=treeitem]"));
      expect(items.filter((element) => element.tabIndex === 0).map(nameOf)).toEqual(["src"]);
      expect(positionOf(items[0] as HTMLElement)).toEqual([1, 1, 3]);
      // Through the story's wrapper component too: one tab stop, on the first item.
      container.innerHTML = renderToString(<StoryView story={stories.FileTree} />);
      expect(
        Array.from(container.querySelectorAll<HTMLElement>("[role=treeitem]"))
          .filter((element) => element.tabIndex === 0)
          .map(nameOf),
      ).toEqual(["src"]);
    });

    it("sets aria-level, aria-setsize and aria-posinset on every item", async () => {
      await render(<Files defaultExpandedValues={["src", "components", "docs"]} />);
      const expected: Record<string, [number, number, number]> = {
        src: [1, 3, 1],
        components: [2, 2, 1],
        "button.tsx": [3, 2, 1],
        "card.tsx": [3, 2, 2],
        "index.ts": [2, 2, 2],
        docs: [1, 3, 2],
        "readme.md": [2, 1, 1],
        "package.json": [1, 3, 3],
      };
      for (const [name, [level, setsize, posinset]] of Object.entries(expected)) {
        const element = item(name);
        expect(element.getAttribute("aria-level"), name).toBe(String(level));
        expect(element.getAttribute("aria-setsize"), name).toBe(String(setsize));
        expect(element.getAttribute("aria-posinset"), name).toBe(String(posinset));
      }
    });

    it("sets aria-expanded on parents only, and no aria-selected without a selection mode", async () => {
      await render(<Files defaultExpandedValues={["src"]} />);
      expect(item("src").getAttribute("aria-expanded")).toBe("true");
      expect(item("components").getAttribute("aria-expanded")).toBe("false");
      expect(item("docs").getAttribute("aria-expanded")).toBe("false");
      expect(item("index.ts").hasAttribute("aria-expanded")).toBe(false);
      expect(item("package.json").hasAttribute("aria-expanded")).toBe(false);
      for (const element of tree().querySelectorAll("[role=treeitem]"))
        expect(element.hasAttribute("aria-selected")).toBe(false);
    });

    it("sets aria-selected on every item when selectable, and aria-multiselectable when multiple", async () => {
      await render(<Files selectionMode="multiple" defaultSelectedValues={["docs"]} />);
      expect(tree().getAttribute("aria-multiselectable")).toBe("true");
      expect(item("docs").getAttribute("aria-selected")).toBe("true");
      expect(item("src").getAttribute("aria-selected")).toBe("false");
      expect(item("package.json").getAttribute("aria-selected")).toBe("false");
    });

    it("single selection does not set aria-multiselectable", async () => {
      await render(<Files selectionMode="single" />);
      expect(tree().hasAttribute("aria-multiselectable")).toBe(false);
      expect(item("src").getAttribute("aria-selected")).toBe("false");
    });

    it("indents each row by its level through --tree-level", async () => {
      await render(<Files defaultExpandedValues={["src", "components"]} />);
      const padding = (name: string) => getComputedStyle(rowOf(item(name))).paddingInlineStart;
      expect(padding("src")).toBe("8px");
      expect(padding("components")).toBe("24px");
      expect(padding("button.tsx")).toBe("40px");
      expect(rowOf(item("src")).className).toContain("ps-[calc(var(--tree-level)*1rem+0.5rem)]");
    });
  });

  describe("roving tabindex", () => {
    it("starts on the first item", async () => {
      await render(<Files />);
      await expect.poll(tabbable).toEqual(["src"]);
    });

    it("starts on the first visible selected item", async () => {
      await render(
        <Files selectionMode="multiple" defaultSelectedValues={["readme.md", "package.json"]} />,
      );
      // readme.md is hidden inside the collapsed docs folder, so package.json is the first visible.
      await expect.poll(tabbable).toEqual(["package.json"]);
    });

    it("follows focus, keeping exactly one tabbable item", async () => {
      await render(<Files defaultExpandedValues={["src"]} />);
      await tabIn("src");
      await press("{ArrowDown}", "components");
      expect(tabbable()).toEqual(["components"]);
      await press("{End}", "package.json");
      expect(tabbable()).toEqual(["package.json"]);
      await userEvent.tab();
      await expect.poll(() => document.activeElement).toBe(document.body);
      expect(tabbable()).toEqual(["package.json"]);
      await userEvent.tab({ shift: true });
      await expect.poll(focused).toBe("package.json");
    });

    it("moves to a selection that arrives after mount while the tree has never been focused", async () => {
      function Controlled() {
        const [selected, setSelected] = useState<string[]>([]);
        return (
          <>
            <button type="button" onClick={() => setSelected(["docs"])}>
              Select docs
            </button>
            <Files
              selectionMode="single"
              selectedValues={selected}
              onSelectedValuesChange={setSelected}
            />
          </>
        );
      }
      await render(<Controlled />);
      await expect.poll(tabbable).toEqual(["src"]);
      await userEvent.click(page.getByRole("button", { name: "Select docs" }));
      await expect.poll(tabbable).toEqual(["docs"]);
      await userEvent.tab();
      await expect.poll(focused).toBe("docs");
    });

    it("keeps focus in the tree when a controlled collapse hides the focused item", async () => {
      let setExpanded: (values: string[]) => void = () => {};
      function Controlled() {
        const [expanded, set] = useState(["src", "components"]);
        setExpanded = set;
        return <Files expandedValues={expanded} onExpandedValuesChange={set} />;
      }
      await render(<Controlled />);
      await tabIn("src");
      await press("{ArrowDown}", "components");
      await press("{ArrowDown}", "button.tsx");
      // Collapsing the parent moves focus to it, the nearest visible ancestor.
      setExpanded(["src"]);
      await expect.poll(focused).toBe("components");
      expect(tabbable()).toEqual(["components"]);
      // Collapsing two levels at once moves it to the visible ancestor further up.
      await press("{ArrowRight}");
      await expect.poll(() => item("components").getAttribute("aria-expanded")).toBe("true");
      await press("{ArrowDown}", "button.tsx");
      setExpanded([]);
      await expect.poll(focused).toBe("src");
      expect(tabbable()).toEqual(["src"]);
    });

    it("falls back when the tabbable item is hidden", async () => {
      function Controlled() {
        const [expanded, setExpanded] = useState(["src"]);
        return (
          <>
            <button type="button" onClick={() => setExpanded([])}>
              Collapse all
            </button>
            <Files expandedValues={expanded} onExpandedValuesChange={setExpanded} />
          </>
        );
      }
      await render(<Controlled />);
      await userEvent.tab();
      await tabIn("src");
      await press("{ArrowDown}", "components");
      await userEvent.click(page.getByRole("button", { name: "Collapse all" }));
      await expect.poll(visibleNames).toEqual(["src", "docs", "package.json"]);
      await expect.poll(tabbable).toEqual(["src"]);
    });
  });

  describe("keyboard", () => {
    it("↓/↑ move through the visible items without wrapping", async () => {
      await render(<Files defaultExpandedValues={["src"]} />);
      await tabIn("src");
      await press("{ArrowUp}");
      expect(focused()).toBe("src");
      await press("{ArrowDown}", "components");
      await press("{ArrowDown}", "index.ts");
      await press("{ArrowDown}", "docs");
      await press("{ArrowDown}", "package.json");
      await press("{ArrowDown}");
      expect(focused()).toBe("package.json");
      await press("{ArrowUp}", "docs");
    });

    it("→ expands a closed parent, then moves to its first child; does nothing on a leaf", async () => {
      const onExpandedValuesChange = vi.fn();
      await render(<Files onExpandedValuesChange={onExpandedValuesChange} />);
      await tabIn("src");
      await press("{ArrowRight}");
      await expect.poll(() => item("src").getAttribute("aria-expanded")).toBe("true");
      expect(focused()).toBe("src");
      expect(onExpandedValuesChange).toHaveBeenLastCalledWith(["src"]);
      await press("{ArrowRight}", "components");
      await press("{ArrowDown}", "index.ts");
      await press("{ArrowRight}");
      expect(focused()).toBe("index.ts");
      expect(onExpandedValuesChange).toHaveBeenCalledTimes(1);
    });

    it("← collapses an open parent, moves from a child to its parent, and does nothing at the root", async () => {
      await render(<Files defaultExpandedValues={["src", "components"]} />);
      await tabIn("src");
      await press("{ArrowDown}", "components");
      await press("{ArrowDown}", "button.tsx");
      await press("{ArrowLeft}", "components");
      await press("{ArrowLeft}");
      await expect.poll(() => item("components").getAttribute("aria-expanded")).toBe("false");
      expect(focused()).toBe("components");
      await press("{ArrowLeft}", "src");
      await press("{ArrowLeft}");
      await expect.poll(() => item("src").getAttribute("aria-expanded")).toBe("false");
      await press("{ArrowLeft}");
      expect(focused()).toBe("src");
      expect(visibleNames()).toEqual(["src", "docs", "package.json"]);
    });

    it("Home and End go to the first and last visible items", async () => {
      await render(<Files defaultExpandedValues={["docs"]} />);
      await tabIn("src");
      await press("{End}", "package.json");
      await press("{Home}", "src");
      await press("{ArrowDown}", "docs");
      await press("{End}", "package.json");
    });

    it("RTL flips ← and →", async () => {
      await render(
        <div dir="rtl">
          <Files defaultExpandedValues={["src"]} />
        </div>,
      );
      await tabIn("src");
      await press("{ArrowDown}", "components");
      await press("{ArrowLeft}");
      await expect.poll(() => item("components").getAttribute("aria-expanded")).toBe("true");
      await press("{ArrowLeft}", "button.tsx");
      await press("{ArrowRight}", "components");
      await press("{ArrowRight}");
      await expect.poll(() => item("components").getAttribute("aria-expanded")).toBe("false");
      await press("{ArrowRight}", "src");
    });

    it("* expands every sibling of the focused item, and keeps focus", async () => {
      const onExpandedValuesChange = vi.fn();
      await render(<Files onExpandedValuesChange={onExpandedValuesChange} />);
      await tabIn("src");
      await press("*");
      await expect.poll(() => item("docs").getAttribute("aria-expanded")).toBe("true");
      expect(item("src").getAttribute("aria-expanded")).toBe("true");
      // Only the siblings: the nested components folder stays closed.
      expect(item("components").getAttribute("aria-expanded")).toBe("false");
      expect(focused()).toBe("src");
      expect(onExpandedValuesChange).toHaveBeenLastCalledWith(["src", "docs"]);
    });

    describe("typeahead", () => {
      it("jumps to the next visible item starting with the typed character, and cycles", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0, 0));
        await render(
          <Files
            defaultExpandedValues={["src"]}
            extra={
              <>
                <Leaf value="Dockerfile" />
                <Leaf value="deno.json" />
              </>
            }
          />,
        );
        await tabIn("src");
        await press("d", "docs");
        vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 1, 0));
        await press("d", "Dockerfile");
        vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 2, 0));
        await press("d", "deno.json");
        vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 3, 0));
        // Wraps to the top.
        await press("d", "docs");
        vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 4, 0));
        await press("i", "index.ts");
      });

      it("repeating one character within the buffer cycles through the matches", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0, 0));
        await render(<Files extra={<Leaf value="Dockerfile" />} />);
        await tabIn("src");
        await press("d", "docs");
        await press("d", "Dockerfile");
        await press("d", "docs");
      });

      it("matches several characters typed within 500ms", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0, 0));
        await render(<Files extra={<Leaf value="docker" />} />);
        await tabIn("src");
        await press("d", "docs");
        vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0, 200));
        await press("o");
        expect(focused()).toBe("docs");
        vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0, 400));
        await press("c");
        expect(focused()).toBe("docs");
        vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0, 600));
        await press("k", "docker");
      });

      it("starts a new search after 500ms without typing", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0, 0));
        await render(<Files />);
        await tabIn("src");
        await press("p", "package.json");
        vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0, 499));
        // "pa" still matches package.json.
        await press("a");
        expect(focused()).toBe("package.json");
        vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 1, 0));
        await press("s", "src");
      });

      it("is case-insensitive, uses the label prop, and only sees visible items", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0, 0));
        await render(
          <Files
            extra={
              <TreeItem value="notes" label="Zebra notes">
                <TreeItemContent>🦓 notes</TreeItemContent>
              </TreeItem>
            }
          />,
        );
        await tabIn("src");
        // readme.md is inside the collapsed docs folder.
        await press("r");
        expect(focused()).toBe("src");
        vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 1, 0));
        await press("Z", "🦓 notes");
        vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 2, 0));
        await press("P", "package.json");
      });

      it("Space continues a search while the buffer is active, and selects once it has lapsed", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0, 0));
        await render(
          <Files
            selectionMode="multiple"
            extra={
              <>
                <Leaf value="new file" />
                <Leaf value="new folder" />
              </>
            }
          />,
        );
        await tabIn("src");
        await press("n", "new file");
        for (const key of ["e", "w", " ", "f"]) {
          await press(key);
          expect(focused()).toBe("new file");
        }
        await press("o", "new folder");
        expect(selectedNames()).toEqual([]);
        vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 1, 0));
        await press(" ");
        await expect.poll(selectedNames).toEqual(["new folder"]);
      });
    });

    it("Enter fires onAction; a disabled item is focusable but not actionable", async () => {
      const onAction = vi.fn();
      await render(<Files onAction={onAction} extra={<Leaf value="locked" disabled />} />);
      await tabIn("src");
      await press("{Enter}");
      expect(onAction).toHaveBeenCalledExactlyOnceWith("src");
      await press("{End}", "locked");
      expect(item("locked").getAttribute("aria-disabled")).toBe("true");
      await press("{Enter}");
      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it("Enter also selects in single mode, and does not select in multiple mode", async () => {
      const onAction = vi.fn();
      const { rerender } = await render(<Files selectionMode="single" onAction={onAction} />);
      await tabIn("src");
      await press("{ArrowDown}", "docs");
      await press("{Enter}");
      await expect.poll(selectedNames).toEqual(["docs"]);
      expect(onAction).toHaveBeenCalledExactlyOnceWith("docs");
      await press("{ArrowDown}", "package.json");
      await press("{Enter}");
      await expect.poll(selectedNames).toEqual(["package.json"]);
      await rerender(<Files selectionMode="multiple" onAction={onAction} />);
      await press("{Enter}");
      expect(onAction).toHaveBeenCalledTimes(3);
      expect(selectedNames()).toEqual(["package.json"]);
    });

    it("Space toggles the selection in single mode", async () => {
      const onSelectedValuesChange = vi.fn();
      await render(
        <Files selectionMode="single" onSelectedValuesChange={onSelectedValuesChange} />,
      );
      await tabIn("src");
      await press(" ");
      await expect.poll(selectedNames).toEqual(["src"]);
      await press("{ArrowDown}", "docs");
      await press(" ");
      await expect.poll(selectedNames).toEqual(["docs"]);
      await press(" ");
      await expect.poll(selectedNames).toEqual([]);
      expect(onSelectedValuesChange.mock.calls).toEqual([[["src"]], [["docs"]], [[]]]);
    });

    it("Space toggles each item in multiple mode", async () => {
      await render(<Files selectionMode="multiple" />);
      await tabIn("src");
      await press(" ");
      await press("{ArrowDown}", "docs");
      await press(" ");
      await expect.poll(selectedNames).toEqual(["src", "docs"]);
      await press(" ");
      await expect.poll(selectedNames).toEqual(["src"]);
    });

    it("Space does nothing without a selection mode", async () => {
      const onSelectedValuesChange = vi.fn();
      await render(<Files onSelectedValuesChange={onSelectedValuesChange} />);
      await tabIn("src");
      await press(" ");
      expect(onSelectedValuesChange).not.toHaveBeenCalled();
      expect(item("src").hasAttribute("aria-selected")).toBe(false);
    });

    it("Shift+↓/↑ extend the selection from the anchor in multiple mode", async () => {
      const onSelectedValuesChange = vi.fn();
      await render(
        <Files
          selectionMode="multiple"
          defaultExpandedValues={["src"]}
          onSelectedValuesChange={onSelectedValuesChange}
        />,
      );
      await tabIn("src");
      await press("{ArrowDown}", "components");
      await press(" ");
      await expect.poll(selectedNames).toEqual(["components"]);
      await press("{Shift>}{ArrowDown}{/Shift}", "index.ts");
      await expect.poll(selectedNames).toEqual(["components", "index.ts"]);
      await press("{Shift>}{ArrowDown}{/Shift}", "docs");
      await expect.poll(selectedNames).toEqual(["components", "index.ts", "docs"]);
      // Back towards the anchor shrinks the range.
      await press("{Shift>}{ArrowUp}{/Shift}", "index.ts");
      await expect.poll(selectedNames).toEqual(["components", "index.ts"]);
      // Past the anchor the range flips.
      await press("{Shift>}{ArrowUp}{/Shift}", "components");
      await press("{Shift>}{ArrowUp}{/Shift}", "src");
      await expect.poll(selectedNames).toEqual(["src", "components"]);
    });

    it("Shift+↓ keeps the selection outside the range", async () => {
      await render(<Files selectionMode="multiple" defaultSelectedValues={["package.json"]} />);
      await tabIn("package.json");
      await press("{Home}", "src");
      await press("{Shift>}{ArrowDown}{/Shift}", "docs");
      await expect.poll(selectedNames).toEqual(["src", "docs", "package.json"]);
    });

    it("a plain arrow drops the anchor, so the next Shift+arrow starts where it is pressed", async () => {
      await render(<Files selectionMode="multiple" />);
      await tabIn("src");
      await press("{ArrowDown}", "docs");
      // Space makes docs the anchor.
      await press(" ");
      await expect.poll(selectedNames).toEqual(["docs"]);
      await press("{ArrowUp}", "src");
      // With the anchor still at docs, this range would be docs..docs and src would stay out.
      await press("{Shift>}{ArrowDown}{/Shift}", "docs");
      await expect.poll(selectedNames).toEqual(["src", "docs"]);
    });

    it("Shift+Home and Shift+End extend the selection to the first and last visible items", async () => {
      await render(<Files selectionMode="multiple" />);
      await tabIn("src");
      await press("{ArrowDown}", "docs");
      await press(" ");
      await press("{Shift>}{End}{/Shift}", "package.json");
      await expect.poll(selectedNames).toEqual(["docs", "package.json"]);
      await press("{Shift>}{Home}{/Shift}", "src");
      await expect.poll(selectedNames).toEqual(["src", "docs"]);
    });

    it("Shift+↓ moves without selecting in single mode", async () => {
      await render(<Files selectionMode="single" />);
      await tabIn("src");
      await press("{Shift>}{ArrowDown}{/Shift}", "docs");
      expect(selectedNames()).toEqual([]);
    });

    it("Ctrl+A and ⌘+A select every visible, enabled item in multiple mode", async () => {
      const onSelectedValuesChange = vi.fn();
      await render(
        <Files
          selectionMode="multiple"
          defaultSelectedValues={["readme.md"]}
          onSelectedValuesChange={onSelectedValuesChange}
          extra={<Leaf value="locked" disabled />}
        />,
      );
      await tabIn("src");
      await press("{Control>}a{/Control}");
      await expect.poll(selectedNames).toEqual(["src", "docs", "package.json"]);
      // The hidden readme.md stays selected; the disabled item is not selected.
      expect(onSelectedValuesChange).toHaveBeenLastCalledWith([
        "readme.md",
        "src",
        "docs",
        "package.json",
      ]);
      expect(item("locked").getAttribute("aria-selected")).toBe("false");
      await press(" ");
      await expect.poll(selectedNames).toEqual(["docs", "package.json"]);
      await press("{Meta>}a{/Meta}");
      await expect.poll(selectedNames).toEqual(["src", "docs", "package.json"]);
    });

    it("Ctrl+A does nothing in single mode", async () => {
      const onSelectedValuesChange = vi.fn();
      await render(
        <Files selectionMode="single" onSelectedValuesChange={onSelectedValuesChange} />,
      );
      await tabIn("src");
      await press("{Control>}a{/Control}");
      expect(onSelectedValuesChange).not.toHaveBeenCalled();
    });

    it("a disabled item is focusable but Space and Shift+↓ do not select it", async () => {
      await render(<Files selectionMode="multiple" extra={<Leaf value="locked" disabled />} />);
      await tabIn("src");
      await press("{End}", "locked");
      await press(" ");
      expect(selectedNames()).toEqual([]);
      await press("{ArrowUp}", "package.json");
      await press(" ");
      await press("{Shift>}{ArrowDown}{/Shift}", "locked");
      await expect.poll(selectedNames).toEqual(["package.json"]);
    });

    it("a disabled parent still expands and collapses", async () => {
      await render(
        <Tree aria-label="Files">
          <TreeItem value="archive" disabled>
            <TreeItemContent>archive</TreeItemContent>
            <Leaf value="old.txt" />
          </TreeItem>
        </Tree>,
      );
      await tabIn("archive");
      await press("{ArrowRight}");
      await press("{ArrowRight}", "old.txt");
    });
  });

  describe("pointer", () => {
    it("clicking a row focuses and selects it; a second click in multiple mode deselects", async () => {
      await render(<Files selectionMode="multiple" />);
      await userEvent.click(rowOf(item("docs")));
      await expect.poll(focused).toBe("docs");
      await expect.poll(selectedNames).toEqual(["docs"]);
      await userEvent.click(rowOf(item("package.json")));
      await expect.poll(selectedNames).toEqual(["docs", "package.json"]);
      await userEvent.click(rowOf(item("docs")));
      await expect.poll(selectedNames).toEqual(["package.json"]);
      expect(tabbable()).toEqual(["docs"]);
    });

    it("clicking a row in single mode replaces the selection", async () => {
      await render(<Files selectionMode="single" defaultSelectedValues={["src"]} />);
      await userEvent.click(rowOf(item("docs")));
      await expect.poll(selectedNames).toEqual(["docs"]);
      await userEvent.click(rowOf(item("docs")));
      expect(selectedNames()).toEqual(["docs"]);
    });

    it("clicking the chevron toggles the parent without selecting it", async () => {
      await render(<Files selectionMode="single" />);
      const chevron = item("src").querySelector("[data-slot=tree-item-chevron]") as HTMLElement;
      await userEvent.click(chevron);
      await expect.poll(() => item("src").getAttribute("aria-expanded")).toBe("true");
      expect(selectedNames()).toEqual([]);
      await userEvent.click(chevron);
      await expect.poll(() => item("src").getAttribute("aria-expanded")).toBe("false");
    });

    it("double-click fires onAction and leaves a multiple selection as one click left it", async () => {
      const onAction = vi.fn();
      await render(<Files selectionMode="multiple" onAction={onAction} />);
      await userEvent.dblClick(rowOf(item("docs")));
      expect(onAction).toHaveBeenCalledExactlyOnceWith("docs");
      await expect.poll(selectedNames).toEqual(["docs"]);
    });

    it("a disabled row is not selected or actioned by the pointer", async () => {
      const onAction = vi.fn();
      await render(
        <Files
          selectionMode="multiple"
          onAction={onAction}
          extra={<Leaf value="locked" disabled />}
        />,
      );
      const row = rowOf(item("locked"));
      expect(getComputedStyle(row).cursor).toBe("not-allowed");
      // Muted text, not row opacity: the row's focus ring must stay at full strength.
      expect(getComputedStyle(row).opacity).toBe("1");
      expect(row.className).toContain("data-disabled:text-muted-foreground");
      expect(getComputedStyle(row).color).not.toBe(getComputedStyle(rowOf(item("src"))).color);
      await userEvent.dblClick(row);
      expect(onAction).not.toHaveBeenCalled();
      expect(selectedNames()).toEqual([]);
    });

    it("a focused disabled row keeps a full-strength ring", async () => {
      await render(<Files extra={<Leaf value="locked" disabled />} />);
      await tabIn("src");
      await press("{End}", "locked");
      const row = rowOf(item("locked"));
      await expect.poll(() => getComputedStyle(row).outlineStyle).toBe("solid");
      await expect
        .poll(() => getComputedStyle(row).outlineColor)
        .toBe(getComputedStyle(rowOf(item("src"))).getPropertyValue("outline-color"));
      expect(getComputedStyle(row).opacity).toBe("1");
    });
  });

  describe("controlled and uncontrolled", () => {
    it("controlled expandedValues only change through the prop", async () => {
      const onExpandedValuesChange = vi.fn();
      await render(<Files expandedValues={[]} onExpandedValuesChange={onExpandedValuesChange} />);
      await tabIn("src");
      await press("{ArrowRight}");
      expect(onExpandedValuesChange).toHaveBeenCalledExactlyOnceWith(["src"]);
      expect(item("src").getAttribute("aria-expanded")).toBe("false");
    });

    it("controlled expansion follows the parent's state", async () => {
      await render(<StoryView story={stories.ControlledExpansion} />);
      await expect.poll(() => item("src").getAttribute("aria-expanded")).toBe("true");
      await userEvent.click(page.getByRole("button", { name: "Collapse all" }));
      await expect.poll(() => item("src").getAttribute("aria-expanded")).toBe("false");
      await userEvent.click(page.getByRole("button", { name: "Expand all" }));
      await expect.poll(() => item("components").getAttribute("aria-expanded")).toBe("true");
    });

    it("uncontrolled expansion starts from defaultExpandedValues", async () => {
      await render(<Files defaultExpandedValues={["docs"]} />);
      expect(visibleNames()).toEqual(["src", "docs", "readme.md", "package.json"]);
    });

    it("controlled selectedValues only change through the prop", async () => {
      const onSelectedValuesChange = vi.fn();
      await render(
        <Files
          selectionMode="multiple"
          selectedValues={["docs"]}
          onSelectedValuesChange={onSelectedValuesChange}
        />,
      );
      await tabIn("docs");
      await press("{ArrowDown}", "package.json");
      await press(" ");
      expect(onSelectedValuesChange).toHaveBeenCalledExactlyOnceWith(["docs", "package.json"]);
      expect(selectedNames()).toEqual(["docs"]);
    });

    it("controlled selection follows the parent's state", async () => {
      function Controlled() {
        const [selected, setSelected] = useState<string[]>([]);
        return (
          <>
            <output>{selected.join(",")}</output>
            <Files
              selectionMode="multiple"
              selectedValues={selected}
              onSelectedValuesChange={setSelected}
            />
          </>
        );
      }
      await render(<Controlled />);
      await tabIn("src");
      await press(" ");
      await expect.poll(selectedNames).toEqual(["src"]);
      expect(document.querySelector("output")?.textContent).toBe("src");
    });
  });

  describe("styling", () => {
    it("hovers bg-accent, selects bg-primary-soft, and rotates the chevron on expand", async () => {
      await render(<Files selectionMode="single" defaultSelectedValues={["docs"]} />);
      const src = rowOf(item("src"));
      expect(src.className).toContain("hover:bg-accent");
      const docs = rowOf(item("docs"));
      expect(docs.className).toContain("data-selected:bg-primary-soft");
      expect(docs.className).toContain("data-selected:text-primary-soft-foreground");
      expect(getComputedStyle(docs).backgroundColor).not.toBe(
        getComputedStyle(src).backgroundColor,
      );
      const chevron = item("src").querySelector("[data-slot=tree-item-chevron]") as HTMLElement;
      expect(getComputedStyle(chevron).rotate).toBe("none");
      expect(getComputedStyle(chevron).transitionDuration).not.toBe("0s");
      await userEvent.click(chevron);
      await expect.poll(() => getComputedStyle(chevron).rotate).toBe("90deg");
    });

    it("mirrors the chevron in RTL and turns it down when expanded", async () => {
      await render(
        <div dir="rtl">
          <Files defaultExpandedValues={["src"]} />
        </div>,
      );
      const chevron = (name: string) =>
        item(name).querySelector("[data-slot=tree-item-chevron]") as HTMLElement;
      expect(getComputedStyle(chevron("docs")).scale).toBe("-1 1");
      expect(getComputedStyle(chevron("docs")).rotate).toBe("none");
      expect(getComputedStyle(chevron("src")).rotate).toBe("-90deg");
    });

    it("the chevron does not animate under reduced motion", async () => {
      await emulateReducedMotion(true);
      await render(<Files />);
      const chevron = item("src").querySelector("[data-slot=tree-item-chevron]") as HTMLElement;
      expect(getComputedStyle(chevron).transitionProperty).toBe("none");
      expect(getComputedStyle(rowOf(item("src"))).transitionProperty).toBe("none");
    });

    it("keyboard focus draws a 2px solid inset ring on the row", async () => {
      await render(<Files />);
      const row = rowOf(item("src"));
      expect(getComputedStyle(row).outlineStyle).toBe("none");
      await tabIn("src");
      await expect.poll(() => getComputedStyle(row).outlineStyle).toBe("solid");
      expect(getComputedStyle(row).outlineWidth).toBe("2px");
      expect(getComputedStyle(row).outlineOffset).toBe("-2px");
      expect(getComputedStyle(item("src")).outlineStyle).toBe("none");
      // The ring is on the focused row only, not on the rows nested inside it.
      await press("{ArrowRight}");
      await expect.poll(() => item("src").getAttribute("aria-expanded")).toBe("true");
      expect(getComputedStyle(rowOf(item("components"))).outlineStyle).toBe("none");
    });
  });

  describe("forced colors", () => {
    it("the focus ring is Highlight and shows only on focus", async () => {
      await emulateForcedColors(true);
      await render(<Files />);
      const row = rowOf(item("src"));
      expect(getComputedStyle(row).outlineStyle).toBe("none");
      await tabIn("src");
      await expect.poll(() => getComputedStyle(row).outlineStyle).toBe("solid");
      // The outline colour transitions (150ms) into the system colour.
      await expect.poll(() => getComputedStyle(row).outlineColor).toBe(systemColor("Highlight"));
    });

    it("a disabled row and its icons are GrayText", async () => {
      await emulateForcedColors(true);
      await render(
        <Tree aria-label="Files">
          <TreeItem value="vendor" disabled>
            <TreeItemContent>
              <TreeItemIcon>
                <svg />
              </TreeItemIcon>
              vendor
            </TreeItemContent>
            <Leaf value="lib.js" />
          </TreeItem>
          <Leaf value="index.ts" />
        </Tree>,
      );
      const row = rowOf(item("vendor"));
      expect(getComputedStyle(row).color).toBe(systemColor("GrayText"));
      for (const slot of ["tree-item-chevron", "tree-item-icon"])
        expect(
          getComputedStyle(row.querySelector(`[data-slot=${slot}]`) as HTMLElement).color,
          slot,
        ).toBe(systemColor("GrayText"));
      expect(getComputedStyle(rowOf(item("index.ts"))).color).not.toBe(systemColor("GrayText"));
    });

    it("a selected row is Highlight with HighlightText and no backplate", async () => {
      await emulateForcedColors(true);
      await render(<Files selectionMode="multiple" defaultSelectedValues={["src"]} />);
      const selected = rowOf(item("src"));
      const style = getComputedStyle(selected);
      expect(style.backgroundColor).toBe(systemColor("Highlight"));
      expect(style.color).toBe(systemColor("HighlightText"));
      expect(style.getPropertyValue("forced-color-adjust")).toBe("none");
      const chevron = selected.querySelector("[data-slot=tree-item-chevron]") as HTMLElement;
      expect(getComputedStyle(chevron).color).toBe(systemColor("HighlightText"));
      expect(getComputedStyle(rowOf(item("docs"))).getPropertyValue("forced-color-adjust")).toBe(
        "auto",
      );
      // Focused and selected: the inset ring is HighlightText, which shows on the Highlight fill.
      await tabIn("src");
      await expect.poll(() => getComputedStyle(selected).outlineStyle).toBe("solid");
      await expect
        .poll(() => getComputedStyle(selected).outlineColor)
        .toBe(systemColor("HighlightText"));
    });

    it("a hovered selected row stays Highlight (the hover tint does not replace it)", async () => {
      await emulateForcedColors(true);
      await render(<Files selectionMode="single" defaultSelectedValues={["src"]} />);
      const selected = rowOf(item("src"));
      await userEvent.hover(selected);
      await expect.poll(() => selected.matches(":hover")).toBe(true);
      // The background transitions (150ms) to the hover target: read it once that has settled.
      await expect.poll(() => selected.getAnimations().length).toBe(0);
      expect(getComputedStyle(selected).backgroundColor).toBe(systemColor("Highlight"));
    });
  });

  it.each(["light", "dark"] as const)("has no axe violations (%s)", async (theme) => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    const screen = await render(
      <div className="bg-background p-4 text-foreground">
        <StoryView story={stories.FileTree} />
        <StoryView story={stories.MultiSelect} />
        <StoryView story={stories.DisabledItems} />
      </div>,
    );
    await expect.poll(() => document.querySelectorAll("[role=tree]").length).toBe(3);
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(
      results.incomplete.map(
        (v) => `${v.id}: ${v.help} (${v.nodes.map((node) => node.html).join(", ")})`,
      ),
    ).toEqual([]);
  });
});
