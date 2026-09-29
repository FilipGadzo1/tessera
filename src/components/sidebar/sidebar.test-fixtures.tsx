import axe from "axe-core";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeEach } from "vitest";
import { page, userEvent } from "vitest/browser";
import { resetEmulatedMedia } from "../../../test/emulation";
import { DotIcon } from "../../lib/icons";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  type SidebarProps,
  SidebarProvider,
  type SidebarProviderProps,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from ".";

/* Shared fixtures for sidebar.test.tsx and sidebar-menu.test.tsx (not a test file itself). */

export interface ShellProps {
  provider?: Omit<SidebarProviderProps, "children">;
  sidebar?: Omit<SidebarProps, "children">;
  inset?: ReactNode;
}

/** A full shell: header, a group with an action, links, a badge, a sub list, a footer and a rail. */
export function Shell({ provider, sidebar, inset }: ShellProps) {
  return (
    <SidebarProvider {...provider}>
      <Sidebar {...sidebar}>
        <SidebarHeader>Acme Inc.</SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <SidebarGroupAction aria-label="Add project">
              <DotIcon />
            </SidebarGroupAction>
            <SidebarGroupContent>
              <nav aria-label="Main">
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton render={<a href="#home" />} isActive tooltip="Home">
                      <DotIcon />
                      <span>Home</span>
                    </SidebarMenuButton>
                    <SidebarMenuBadge>12</SidebarMenuBadge>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton tooltip="Settings">
                      <DotIcon />
                      <span>Settings</span>
                    </SidebarMenuButton>
                    <SidebarMenuAction aria-label="More settings">
                      <DotIcon />
                    </SidebarMenuAction>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton href="#general" isActive>
                          General
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton href="#billing">Billing</SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </SidebarMenuItem>
                </SidebarMenu>
              </nav>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarSeparator data-testid="separator" />
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" tooltip="Ada Lovelace">
                <DotIcon />
                <span>Ada Lovelace</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header>
          <SidebarTrigger />
        </header>
        {inset}
        <button type="button">Inset action</button>
      </SidebarInset>
    </SidebarProvider>
  );
}

export const aside = () => document.querySelector<HTMLElement>("aside[data-slot=sidebar]");
export const inner = () => document.querySelector<HTMLElement>("[data-slot=sidebar-inner]");
export const rail = () => document.querySelector<HTMLElement>("[data-slot=sidebar-rail]");
export const trigger = () => page.getByRole("button", { name: "Toggle sidebar" });
export const homeLink = () => page.getByRole("link", { name: "Home" });
export const pressShortcut = (modifier: "Control" | "Meta") =>
  userEvent.keyboard(`{${modifier}>}b{/${modifier}}`);

/** axe violations and incomplete results (with the nodes' HTML, so a failure says where). */
export async function axeResults(container: Element) {
  const results = await axe.run(container, { rules: { region: { enabled: false } } });
  return {
    violations: results.violations.map((v) => `${v.id}: ${v.help}`),
    incomplete: results.incomplete.map(
      (v) => `${v.id}: ${v.help} (${v.nodes.map((node) => node.html).join(", ")})`,
    ),
  };
}

/**
 * Registers the file's hooks: a desktop viewport for each test (Vitest's iframe defaults to phone
 * width; the desktop sidebar starts at `md`), and cleanup of the theme and emulated media.
 */
export function setupSidebarTests() {
  beforeEach(async () => {
    await page.viewport(1280, 800);
  });
  afterEach(async () => {
    document.documentElement.classList.remove("dark");
    await resetEmulatedMedia();
  });
  afterAll(async () => {
    await page.viewport(414, 896);
  });
}
