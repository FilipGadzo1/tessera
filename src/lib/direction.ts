/**
 * Whether `element`'s resolved writing direction is right-to-left. Reads the computed style, so a
 * `dir` on any ancestor counts (not just the element's own attribute). Browser-only (it needs a
 * mounted element and forces a style read): call it from an event handler or an effect, or from a
 * client-only render path that already holds a mounted element. The shared client read for a
 * component's own direction is `useElementDirection` (`use-element-direction.ts`: on mount, then
 * only when a `dir` attribute changes). The one render-time caller is Drawer's controlled `open`
 * turning true, which reads the mounted portal container before the panel's first render; never
 * read it where it would run on the server or in every render.
 */
export function isRtl(element: Element): boolean {
  return getComputedStyle(element).direction === "rtl";
}

/** Languages written right to left by default, for engines without `Intl.Locale` text info. */
const RTL_LANGUAGES = new Set(["ar", "arc", "ckb", "dv", "fa", "he", "ps", "sd", "ug", "ur", "yi"]);

type TextInfo = { direction?: string };
type LocaleWithTextInfo = Intl.Locale & { getTextInfo?: () => TextInfo; textInfo?: TextInfo };

/**
 * The script direction of `locale` (spec Phase K §1.2): `Intl.Locale`'s text info where the engine
 * has it (`getTextInfo()`, or the older `textInfo` getter), else the language subtag. A missing or
 * invalid locale is `"ltr"`. Server-safe: it reads only `Intl`, never the DOM, so it may run during
 * render (unlike `isRtl`, which reads the page's direction).
 */
export function getLocaleDirection(locale?: string): "ltr" | "rtl" {
  if (!locale) return "ltr";
  let intlLocale: LocaleWithTextInfo;
  try {
    intlLocale = new Intl.Locale(locale);
  } catch {
    return "ltr";
  }
  const direction = (intlLocale.getTextInfo?.() ?? intlLocale.textInfo)?.direction;
  if (direction === "rtl" || direction === "ltr") return direction;
  return RTL_LANGUAGES.has(intlLocale.language) ? "rtl" : "ltr";
}
