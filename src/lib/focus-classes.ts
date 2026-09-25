/**
 * The shared focus ring for controls without a text-field border (Toggle, ToolbarLink, Calendar's
 * day buttons): 2px solid, offset, the tone ring colour. Server-safe (no "use client" dependents),
 * so it can be imported from server components too.
 */
export const toggleFocusClasses =
  "outline-none outline-offset-2 outline-ring focus-visible:outline-2 focus-visible:outline-solid";
