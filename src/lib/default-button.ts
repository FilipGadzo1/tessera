/**
 * A form's default button, per the HTML spec: the first submit button in tree order whose form
 * owner is the form. That includes buttons outside the form that point at it with `form=<id>`,
 * and `<input type="image">`, which `form.elements` leaves out.
 */
export function findDefaultButton(
  form: HTMLFormElement,
): HTMLButtonElement | HTMLInputElement | null {
  const root = form.getRootNode() as Document | ShadowRoot;
  for (const element of root.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
    "button, input",
  )) {
    if (element.form !== form) continue;
    if (element instanceof HTMLButtonElement) {
      if (element.type === "submit") return element;
    } else if (element.type === "submit" || element.type === "image") {
      return element;
    }
  }
  return null;
}
