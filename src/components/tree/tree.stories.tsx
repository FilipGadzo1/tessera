import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { FileIcon, FolderIcon } from "../../lib/icons";
import { Button } from "../button";
import { Tree, TreeItem, TreeItemContent, TreeItemIcon, type TreeProps } from "./tree";

interface FileNode {
  name: string;
  children?: FileNode[];
  disabled?: boolean;
}

const files: FileNode[] = [
  {
    name: "src",
    children: [
      {
        name: "components",
        children: [{ name: "button.tsx" }, { name: "card.tsx" }, { name: "tree.tsx" }],
      },
      { name: "lib", children: [{ name: "cn.ts" }, { name: "icons.tsx" }] },
      { name: "index.ts" },
    ],
  },
  { name: "docs", children: [{ name: "changelog.md" }, { name: "readme.md" }] },
  { name: "package.json" },
  { name: "tsconfig.json" },
];

/** Every folder's value: the paths are the values, so they are unique across the tree. */
function folderPaths(nodes: FileNode[], parent = ""): string[] {
  return nodes.flatMap((node) => {
    if (!node.children) return [];
    const path = `${parent}${node.name}/`;
    return [path, ...folderPaths(node.children, path)];
  });
}

function FileTreeNode({ node, parent = "" }: { node: FileNode; parent?: string }) {
  const path = node.children ? `${parent}${node.name}/` : `${parent}${node.name}`;
  return (
    <TreeItem value={path} disabled={node.disabled}>
      <TreeItemContent>
        <TreeItemIcon>{node.children ? <FolderIcon /> : <FileIcon />}</TreeItemIcon>
        {node.name}
      </TreeItemContent>
      {node.children?.map((child) => (
        <FileTreeNode key={child.name} node={child} parent={path} />
      ))}
    </TreeItem>
  );
}

function FileTreeItems({ nodes = files }: { nodes?: FileNode[] }) {
  return nodes.map((node) => <FileTreeNode key={node.name} node={node} />);
}

const panel = "w-72 rounded-lg border border-border bg-card p-1 text-card-foreground";

const meta = {
  title: "Components/Tree",
  component: Tree,
  tags: ["autodocs"],
  args: {
    "aria-label": "Files",
    selectionMode: "none",
    defaultExpandedValues: ["src/", "src/components/"],
  },
  argTypes: {
    selectionMode: { control: "inline-radio", options: ["none", "single", "multiple"] },
  },
  render: (args: TreeProps) => (
    <Tree {...args} className={panel}>
      <FileTreeItems />
    </Tree>
  ),
} satisfies Meta<typeof Tree>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A file tree: folders expand with → or the chevron, Enter or a double-click runs `onAction`. */
export const FileTree: Story = {
  render: function Render(args: TreeProps) {
    const [opened, setOpened] = useState<string | null>(null);
    return (
      <div className="flex flex-col gap-3">
        <Tree {...args} className={panel} onAction={setOpened}>
          <FileTreeItems />
        </Tree>
        <p className="text-sm text-muted-foreground">Opened: {opened ?? "nothing yet"}</p>
      </div>
    );
  },
};

/** `selectionMode="single"`: Space, Enter or a click selects one item. */
export const SingleSelect: Story = {
  args: { selectionMode: "single", defaultSelectedValues: ["src/components/tree.tsx"] },
};

/**
 * `selectionMode="multiple"`: Space or a click toggles, Shift+↑/↓ extend the selection from the
 * last toggled item, and Ctrl/⌘+A selects every visible item.
 */
export const MultiSelect: Story = {
  args: {
    "aria-label": "Files to share",
    selectionMode: "multiple",
    defaultSelectedValues: ["src/components/button.tsx", "src/components/card.tsx"],
  },
  render: function Render(args: TreeProps) {
    const [selected, setSelected] = useState<string[]>(args.defaultSelectedValues ?? []);
    return (
      <div className="flex flex-col gap-3">
        <Tree
          {...args}
          className={panel}
          defaultSelectedValues={undefined}
          selectedValues={selected}
          onSelectedValuesChange={setSelected}
        >
          <FileTreeItems />
        </Tree>
        <p className="w-72 text-sm text-muted-foreground">
          {selected.length} selected{selected.length > 0 ? `: ${selected.join(", ")}` : ""}
        </p>
      </div>
    );
  },
};

/** `expandedValues` / `onExpandedValuesChange`: the buttons and the tree share the state. */
export const ControlledExpansion: Story = {
  args: { "aria-label": "Project files" },
  render: function Render(args: TreeProps) {
    const [expanded, setExpanded] = useState<string[]>(["src/"]);
    return (
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setExpanded(folderPaths(files))}>
            Expand all
          </Button>
          <Button size="sm" variant="outline" onClick={() => setExpanded([])}>
            Collapse all
          </Button>
        </div>
        <Tree
          {...args}
          className={panel}
          defaultExpandedValues={undefined}
          expandedValues={expanded}
          onExpandedValuesChange={setExpanded}
        >
          <FileTreeItems />
        </Tree>
        <p className="w-72 text-sm text-muted-foreground">
          Expanded: {expanded.length > 0 ? expanded.join(", ") : "none"}
        </p>
      </div>
    );
  },
};

/** Under `dir="rtl"` the rows indent from the right, the chevrons mirror, and ←/→ swap. */
export const RTL: Story = {
  args: { "aria-label": "الملفات", selectionMode: "single" },
  render: (args: TreeProps) => (
    <div dir="rtl">
      <Tree {...args} className={panel}>
        <FileTreeItems />
      </Tree>
    </div>
  ),
};

const lockedFiles: FileNode[] = [
  {
    name: "src",
    children: [{ name: "index.ts" }, { name: "generated.ts", disabled: true }],
  },
  { name: "vendor", disabled: true, children: [{ name: "lib.js" }] },
  { name: "package.json" },
];

/**
 * Disabled items stay focusable (APG), so a screen reader can find them, but are not selected or
 * actioned. A disabled folder still expands.
 */
export const DisabledItems: Story = {
  args: {
    "aria-label": "Files with locked items",
    selectionMode: "multiple",
    defaultExpandedValues: ["src/"],
  },
  render: (args: TreeProps) => (
    <Tree {...args} className={panel}>
      <FileTreeItems nodes={lockedFiles} />
    </Tree>
  ),
};
