"use client";

import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { createContext, useContext } from "react";
import { mergeClassName } from "../../lib/merge-class-name";
import {
  type TabsVariant,
  tabsDefaults,
  tabsIndicatorClasses,
  tabsListVariants,
  tabsPanelClasses,
  tabsRootClasses,
  tabsTabVariants,
} from "./tabs-variants";

/*
 * The variant is a TabsList prop (it styles the list and decides whether the indicator renders),
 * but each TabsTab needs it too. TabsList provides it through context rather than the Tabs root,
 * so the look lives next to the tabs it styles and a root can hold more than one list.
 */
const TabsVariantContext = createContext<TabsVariant>(tabsDefaults.variant);

/** Base UI Tabs.Root props: `defaultValue` / `value` + `onValueChange`, `orientation`. */
export type TabsProps = BaseTabs.Root.Props;

/** Groups a TabsList and its TabsPanels. `orientation="vertical"` puts the list beside the panels. */
export function Tabs({ className, ...props }: TabsProps) {
  return (
    <BaseTabs.Root
      {...props}
      data-slot="tabs"
      className={mergeClassName(tabsRootClasses, className)}
    />
  );
}

export interface TabsListProps extends BaseTabs.List.Props {
  /**
   * `underline`: text tabs over a rule, with a sliding indicator under the active tab.
   * `segmented`: a muted track with the active tab raised on it.
   * @default "underline"
   */
  variant?: TabsVariant;
}

/** The `role="tablist"` row. Arrow keys move focus (looping), Home/End jump to the ends. */
export function TabsList({
  variant = tabsDefaults.variant,
  className,
  children,
  ...props
}: TabsListProps) {
  return (
    <TabsVariantContext.Provider value={variant}>
      <BaseTabs.List
        {...props}
        data-slot="tabs-list"
        data-variant={variant}
        className={mergeClassName(tabsListVariants({ variant }), className)}
      >
        {children}
        {variant === "underline" && (
          <BaseTabs.Indicator data-slot="tabs-indicator" className={tabsIndicatorClasses} />
        )}
      </BaseTabs.List>
    </TabsVariantContext.Provider>
  );
}

/** Base UI Tabs.Tab props (`value`, `disabled`). */
export type TabsTabProps = BaseTabs.Tab.Props;

/** One tab. Styled by its TabsList's `variant`. */
export function TabsTab({ className, ...props }: TabsTabProps) {
  const variant = useContext(TabsVariantContext);
  return (
    <BaseTabs.Tab
      {...props}
      data-slot="tabs-tab"
      className={mergeClassName(tabsTabVariants({ variant }), className)}
    />
  );
}

/** Base UI Tabs.Panel props (`value`, `keepMounted`). */
export type TabsPanelProps = BaseTabs.Panel.Props;

/** The content for one tab. Focusable (Tab from the active tab lands on it). */
export function TabsPanel({ className, ...props }: TabsPanelProps) {
  return (
    <BaseTabs.Panel
      {...props}
      data-slot="tabs-panel"
      className={mergeClassName(tabsPanelClasses, className)}
    />
  );
}
