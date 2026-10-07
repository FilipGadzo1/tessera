import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getLocaleDirection } from "./direction";

const cases = [
  ["en", "ltr"],
  ["en-US", "ltr"],
  ["ar-EG", "rtl"],
  ["he", "rtl"],
  ["fa-IR", "rtl"],
  ["ur-PK", "rtl"],
  ["ckb", "rtl"],
  ["ku", "ltr"],
  ["de-DE", "ltr"],
] as const;

describe("getLocaleDirection", () => {
  it.each(cases)("%s → %s", (locale, direction) => {
    expect(getLocaleDirection(locale)).toBe(direction);
  });

  it("is ltr for a missing or invalid locale", () => {
    expect(getLocaleDirection(undefined)).toBe("ltr");
    expect(getLocaleDirection("")).toBe("ltr");
    expect(getLocaleDirection("not a locale!")).toBe("ltr");
  });
});

describe("getLocaleDirection without Intl.Locale text info", () => {
  const proto = Intl.Locale.prototype as object;
  const saved = new Map<string, PropertyDescriptor | undefined>();

  beforeEach(() => {
    for (const key of ["getTextInfo", "textInfo"]) {
      saved.set(key, Object.getOwnPropertyDescriptor(proto, key));
      Object.defineProperty(proto, key, { value: undefined, configurable: true, writable: true });
    }
  });

  afterEach(() => {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(proto, key, descriptor);
      else delete (proto as Record<string, unknown>)[key];
    }
    saved.clear();
  });

  it("the stub removes the text info", () => {
    const locale = new Intl.Locale("ar-EG") as Intl.Locale & {
      getTextInfo?: unknown;
      textInfo?: unknown;
    };
    expect(locale.getTextInfo).toBeUndefined();
    expect(locale.textInfo).toBeUndefined();
  });

  it.each(cases)("%s → %s from the language subtag", (locale, direction) => {
    expect(getLocaleDirection(locale)).toBe(direction);
  });

  it.each(["arc", "dv", "ps", "sd", "ug", "yi"])("%s → rtl from the language subtag", (locale) => {
    expect(getLocaleDirection(locale)).toBe("rtl");
  });

  it("is ltr for a missing or invalid locale", () => {
    expect(getLocaleDirection(undefined)).toBe("ltr");
    expect(getLocaleDirection("not a locale!")).toBe("ltr");
  });
});
