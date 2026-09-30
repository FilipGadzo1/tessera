import { afterEach, describe, expect, it } from "vitest";
import { findDefaultButton } from "./default-button";

const hosts: HTMLElement[] = [];

/** Mounts `html` in the document and returns its `<form id="f">`. */
function mount(html: string) {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.append(host);
  hosts.push(host);
  return host.querySelector("form") as HTMLFormElement;
}

afterEach(() => {
  for (const host of hosts.splice(0)) host.remove();
});

describe("findDefaultButton", () => {
  it("returns the first submit button in tree order", () => {
    const form = mount(
      `<form id="f"><input name="a" /><button type="button">x</button>
        <button id="first">go</button><input id="second" type="submit" /></form>`,
    );
    expect(findDefaultButton(form)?.id).toBe("first");
  });

  it("counts a button without a type and ignores reset and plain buttons", () => {
    const form = mount(
      `<form id="f"><button type="reset">r</button><button type="button">b</button>
        <button id="untyped">u</button></form>`,
    );
    expect(findDefaultButton(form)?.id).toBe("untyped");
  });

  it("finds an <input type=image> that form.elements excludes, when it comes first", () => {
    const form = mount(
      `<form id="f"><input id="image" type="image" alt="go" /><button id="later">b</button></form>`,
    );
    expect([...form.elements].some((element) => element.id === "image")).toBe(false);
    expect(findDefaultButton(form)?.id).toBe("image");
  });

  it("returns a disabled image button as the default (the caller then does not submit)", () => {
    const form = mount(
      `<form id="f"><input id="image" type="image" alt="go" disabled /><button id="later">b</button></form>`,
    );
    const button = findDefaultButton(form);
    expect(button?.id).toBe("image");
    expect(button?.disabled).toBe(true);
  });

  it("includes a form-associated button outside the form, in tree order", () => {
    const form = mount(
      `<button id="outside-first" form="f">o</button><form id="f"><button id="inside">i</button></form>`,
    );
    expect(findDefaultButton(form)?.id).toBe("outside-first");
  });

  it("includes a form-associated button after the form when the form has none", () => {
    const form = mount(
      `<form id="f"><input name="a" /></form><button id="outside" form="f">o</button>`,
    );
    expect(findDefaultButton(form)?.id).toBe("outside");
  });

  it("ignores buttons that belong to another form", () => {
    const form = mount(
      `<form id="f"><input name="a" /></form>
        <form id="other"><button id="foreign">f</button></form>
        <button id="redirected" form="other">r</button>`,
    );
    expect(findDefaultButton(form)).toBeNull();
  });

  it("works for a form that is not in the document (its root is a detached element)", () => {
    const host = document.createElement("div");
    host.innerHTML = `<form id="f"><input name="a" /><input id="image" type="image" alt="go" /><button id="b">b</button></form>`;
    const form = host.querySelector("form") as HTMLFormElement;
    expect(findDefaultButton(form)?.id).toBe("image");
  });

  it("returns null when there is no submit button", () => {
    const form = mount(`<form id="f"><input name="a" /><button type="button">b</button></form>`);
    expect(findDefaultButton(form)).toBeNull();
  });
});
