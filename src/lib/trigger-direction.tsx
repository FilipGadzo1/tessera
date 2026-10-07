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
 * Direction for a Base UI overlay root that renders no element of its own (Popover, Menu,
 * Tooltip, Select, …). Its trigger (or input) reads its own element with `useElementDirection`
 * and reports it to the root, whose Base UI `DirectionProvider` sits above the trigger and the
 * portalled popup (React context crosses portals), so the popup's keys and placement follow the
 * trigger's DOM direction. LTR until a trigger mounts, as on the server.
 *
 * One pair per overlay kind: a trigger reports to the nearest root of its own kind, as Base UI's
 * own contexts do, so a `TooltipTrigger` rendering a `PopoverTrigger` reaches both roots.
 */
export function createTriggerDirection() {
  const ReportContext = createContext<((direction: ElementDirection) => void) | null>(null);

  function TriggerDirectionProvider({ children }: { children: ReactNode }) {
    const [direction, setDirection] = useState<ElementDirection>("ltr");
    return (
      <ReportContext.Provider value={setDirection}>
        <DirectionProvider direction={direction}>{children}</DirectionProvider>
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
