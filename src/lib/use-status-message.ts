"use client";

import { useCallback, useState } from "react";

const noBreakSpace = " ";

/**
 * The text of a component's own polite live region (spec Phase K §4.1): render `message` inside an
 * always-present `role="status"` element (a live region must exist before its text changes) and
 * call `announce(text)` for each add / remove / rejection.
 *
 * An announcement identical to the current message appends a no-break space (and the next one
 * removes it), so the DOM text still changes and a screen reader speaks it again. No timer: the
 * message stays until the next one.
 */
export function useStatusMessage(): [message: string, announce: (text: string) => void] {
  const [message, setMessage] = useState("");
  const announce = useCallback((text: string) => {
    // From `text + nbsp`, the same text goes back to plain `text`, as any other text does.
    setMessage((current) => (current === text ? text + noBreakSpace : text));
  }, []);
  return [message, announce];
}
