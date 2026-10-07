"use client";

import { DirectionProvider } from "@base-ui/react/direction-provider";
import {
  createContext,
  type ReactNode,
  type Ref,
  type RefCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { type ElementDirection, useElementDirection } from "./use-element-direction";
import { useMergedRefs } from "./use-merged-refs";

/**
 * The direction the nearest overlay root's trigger reported, shared by every overlay kind: a
 * popup's nearest root is always its own (the popup renders inside it), so a `MenuSub` gets its
 * `Menu`'s or `ContextMenu`'s direction.
 */
const PopupDirectionContext = createContext<ElementDirection | undefined>(undefined);

/**
 * The `dir` for a portalled popup: the direction its root's trigger reported, or `undefined`
 * before any trigger reports (a detached trigger) and outside an overlay root, so the popup then
 * keeps its portal container's direction. Set it on the popup's positioner: the popup takes its
 * CSS direction from its portal container (the document), not from the trigger, and Floating UI
 * reads `start` / `end` alignment from the positioner's computed direction. So the popup's
 * logical classes and alignment follow the trigger even when the `dir` is on a wrapper.
 */
export function usePopupDirection(): ElementDirection | undefined {
  return useContext(PopupDirectionContext);
}

/**
 * Direction for a Base UI overlay root that renders no element of its own (Popover, Menu,
 * Tooltip, Select, …). Its trigger (or input) reads its own element with `useElementDirection`
 * and reports it to the root, whose Base UI `DirectionProvider` sits above the trigger and the
 * portalled popup (React context crosses portals), so the popup's keys and placement follow the
 * trigger's DOM direction. LTR until a trigger mounts, as on the server. The root also provides
 * the reported direction to `usePopupDirection`.
 *
 * One pair per overlay kind: a trigger reports to the nearest root of its own kind, as Base UI's
 * own contexts do, so a `TooltipTrigger` rendering a `PopoverTrigger` reaches both roots.
 */
export function createTriggerDirection() {
  const ReportContext = createContext<((direction: ElementDirection) => void) | null>(null);

  function TriggerDirectionProvider({ children }: { children: ReactNode }) {
    // `undefined` until a trigger reports (none in this tree, e.g. a detached trigger).
    const [direction, setDirection] = useState<ElementDirection | undefined>(undefined);
    return (
      <ReportContext.Provider value={setDirection}>
        <PopupDirectionContext.Provider value={direction}>
          <DirectionProvider direction={direction ?? "ltr"}>{children}</DirectionProvider>
        </PopupDirectionContext.Provider>
      </ReportContext.Provider>
    );
  }

  /** The trigger's ref: merge it onto the trigger element (it also feeds the caller's `ref`). */
  function useTriggerDirectionRef<T extends Element>(ref: Ref<T> | undefined): RefCallback<T> {
    const report = useContext(ReportContext);
    const elementRef = useRef<T | null>(null);
    const direction = useElementDirection(elementRef);
    useLayoutEffect(() => {
      report?.(direction);
    }, [report, direction]);
    return useMergedRefs(elementRef, ref);
  }

  return { TriggerDirectionProvider, useTriggerDirectionRef };
}
