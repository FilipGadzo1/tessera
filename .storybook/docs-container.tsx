import { DocsContainer, type DocsContainerProps } from "@storybook/addon-docs/blocks";
import { type PropsWithChildren, useEffect, useState } from "react";
import { addons } from "storybook/preview-api";
import { themes } from "storybook/theming";

const GLOBALS_UPDATED = "globalsUpdated";

type Globals = Record<string, unknown>;

/**
 * Docs pages (the Introduction MDX and every component's Docs tab) don't run the story
 * decorators, so the toolbar's theme / palette globals never reached them. This container
 * applies them to <html> and gives the docs chrome the matching Storybook theme.
 */
export function ThemedDocsContainer(props: PropsWithChildren<DocsContainerProps>) {
  const initial = props.context.store.userGlobals?.get?.() as Globals | undefined;
  const [globals, setGlobals] = useState<Globals>(initial ?? {});

  useEffect(() => {
    const channel = addons.getChannel();
    const onUpdate = ({ userGlobals }: { userGlobals?: Globals }) => {
      if (userGlobals) setGlobals(userGlobals);
    };
    channel.on(GLOBALS_UPDATED, onUpdate);
    return () => channel.off(GLOBALS_UPDATED, onUpdate);
  }, []);

  const dark = globals.theme === "dark";
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.dataset.primary = String(globals.primary ?? "malachite");
    root.dataset.surface = String(globals.surface ?? "marble");
  }, [dark, globals.primary, globals.surface]);

  return (
    <DocsContainer {...props} theme={dark ? themes.dark : themes.light}>
      {props.children}
    </DocsContainer>
  );
}
