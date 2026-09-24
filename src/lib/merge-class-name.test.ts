import { describe, expect, it } from "vitest";
import { mergeClassName, mergeStyle } from "./merge-class-name";

type State = { disabled: boolean };
const on: State = { disabled: true };
const off: State = { disabled: false };

describe("mergeClassName", () => {
  it("appends a string className after the base", () => {
    expect(mergeClassName<State>("flex gap-2", "text-sm")(off)).toBe("flex gap-2 text-sm");
  });

  it("returns the base when className is undefined", () => {
    expect(mergeClassName<State>("flex gap-2", undefined)(off)).toBe("flex gap-2");
  });

  it("resolves a className state function with the state", () => {
    const merge = mergeClassName<State>("flex", (s) => (s.disabled ? "is-off" : undefined));
    expect(merge(on)).toBe("flex is-off");
    expect(merge(off)).toBe("flex");
  });

  it("lets conflicting caller utilities win (tailwind-merge)", () => {
    expect(mergeClassName<State>("flex flex-col gap-3", "flex-row gap-6")(off)).toBe(
      "flex flex-row gap-6",
    );
    expect(mergeClassName<State>("text-foreground", () => "text-danger")(off)).toBe("text-danger");
  });
});

describe("mergeStyle", () => {
  it("spreads a style object over the base", () => {
    expect(mergeStyle<State>({ minHeight: "1rem", color: "red" }, { color: "blue" })(off)).toEqual({
      minHeight: "1rem",
      color: "blue",
    });
  });

  it("resolves a style state function with the state", () => {
    const merge = mergeStyle<State>({ minHeight: "1rem" }, (s) =>
      s.disabled ? { opacity: 0.5 } : undefined,
    );
    expect(merge(on)).toEqual({ minHeight: "1rem", opacity: 0.5 });
    expect(merge(off)).toEqual({ minHeight: "1rem" });
  });

  it("handles an undefined base and an undefined style", () => {
    expect(mergeStyle<State>(undefined, undefined)(off)).toEqual({});
    expect(mergeStyle<State>(undefined, { color: "red" })(off)).toEqual({ color: "red" });
  });
});
