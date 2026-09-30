import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { auditOpenOverlay, waitForPopupSettled } from "../../../test/overlay";
import { CheckoutPage, fakeServer } from "./checkout-page";

async function tabTo(element: Element, max = 60) {
  for (let i = 0; i < max && document.activeElement !== element; i++)
    await userEvent.keyboard("{Tab}");
  expect(document.activeElement).toBe(element);
}

const el = (locator: { element(): Element }) => locator.element();
const textbox = (name: string) => page.getByRole("textbox", { name, exact: true });
const combobox = (name: string) => page.getByRole("combobox", { name, exact: true });

async function typeInto(locator: { element(): Element }, text: string) {
  await tabTo(el(locator));
  await userEvent.keyboard(text);
}

async function fillContact() {
  await typeInto(textbox("Full name"), "Ada Lovelace");
  await typeInto(textbox("Email"), "ada@example.com");
}

async function openPromo() {
  const trigger = page.getByRole("button", { name: "Promo code", exact: true });
  await tabTo(el(trigger));
  await userEvent.keyboard("{Enter}");
  await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
}

/**
 * Holds the example's fake server (its `fakeServer.wait` delay) until `release()`; no timer is
 * touched. `held()` is how many server calls are waiting, so a test can tell whether an Apply
 * started. Restored in `afterEach`.
 */
function holdServer() {
  const waiting: Array<() => void> = [];
  vi.spyOn(fakeServer, "wait").mockImplementation(
    () => new Promise<void>((resolve) => waiting.push(resolve)),
  );
  return {
    held: () => waiting.length,
    release() {
      for (const resolve of waiting.splice(0)) resolve();
    },
  };
}

const placeOrder = () => page.getByRole("button", { name: "Place order" });

afterEach(() => vi.restoreAllMocks());

const popup = () => document.querySelector<HTMLElement>("[data-slot=navigation-menu-popup]");

describe("CheckoutPage example", () => {
  it("renders the header, the form sections and the order summary", async () => {
    await render(<CheckoutPage />);
    await expect.element(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect.element(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
    await expect.element(textbox("Full name")).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Send code" })).toBeVisible();
    await expect.element(page.getByText("Delivery options")).toBeVisible();
    await expect.element(page.getByText("Order summary")).toBeVisible();
    expect(page.getByRole("textbox", { name: "Verification code" }).elements()).toHaveLength(0);
  });

  it("navigates the header menu by keyboard to a link; no item is marked current", async () => {
    await render(<CheckoutPage />);
    const shop = page.getByRole("button", { name: "Shop" });
    await tabTo(el(shop));
    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByRole("link", { name: /Sneakers/ })).toBeVisible();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement?.tagName).toBe("A");
    expect(document.activeElement?.textContent).toContain("Sneakers");
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => popup()).toBeNull();
    expect(document.activeElement).toBe(el(shop));
    const orders = page.getByRole("link", { name: "Orders" });
    await tabTo(el(orders));
    expect(el(orders).hasAttribute("aria-current")).toBe(false);
    expect(document.querySelectorAll("nav [aria-current]")).toHaveLength(0);
  });

  it("picks a city from the Autocomplete suggestions with the keyboard", async () => {
    await render(<CheckoutPage />);
    await typeInto(combobox("City"), "zag");
    await expect.element(page.getByRole("option", { name: "Zagreb" })).toBeVisible();
    await userEvent.keyboard("{ArrowDown}{Enter}");
    await expect.element(combobox("City")).toHaveValue("Zagreb");
  });

  it("toggles delivery options, with Select all reflecting the group", async () => {
    await render(<CheckoutPage />);
    const all = page.getByRole("checkbox", { name: "Select all" });
    const gift = page.getByRole("checkbox", { name: /^Gift wrap/ });
    const door = page.getByRole("checkbox", { name: "Leave at door" });
    const signature = page.getByRole("checkbox", { name: "Signature on delivery" });
    await tabTo(el(all));
    await userEvent.keyboard(" ");
    for (const box of [gift, door, signature]) await expect.element(box).toBeChecked();
    await userEvent.keyboard(" ");
    for (const box of [gift, door, signature]) await expect.element(box).not.toBeChecked();
    await tabTo(el(gift));
    await userEvent.keyboard(" ");
    await expect.element(all).toHaveAttribute("aria-checked", "mixed");
  });

  it("shows the server's promo error under the Field and clears it on edit", async () => {
    await render(<CheckoutPage />);
    await fillContact();
    await openPromo();
    await typeInto(textbox("Promo code"), "EXPIRED");
    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByText("This code has expired.")).toBeVisible();
    await expect.element(textbox("Promo code")).toHaveAttribute("aria-invalid", "true");
    expect(page.getByText("Order placed").elements()).toHaveLength(0);
    await userEvent.keyboard("{Backspace}");
    await expect.poll(() => page.getByText("This code has expired.").elements().length).toBe(0);
  });

  it("Enter in the promo code applies it instead of placing the order", async () => {
    await render(<CheckoutPage />);
    await openPromo();
    await typeInto(textbox("Promo code"), "SAVE10");
    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByText("Code applied.")).toBeVisible();
    // The contact fields are empty, yet the order was not submitted.
    await expect.element(textbox("Full name")).not.toHaveAttribute("aria-invalid", "true");
    expect(page.getByText("Order placed").elements()).toHaveLength(0);
    expect(document.activeElement).toBe(el(textbox("Promo code")));
    await userEvent.keyboard("{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}");
    await userEvent.keyboard("EXPIRED{Enter}");
    await expect.element(page.getByText("This code has expired.")).toBeVisible();
    expect(page.getByText("Order placed").elements()).toHaveLength(0);
  });

  it("keeps focus on the button while placing, then moves it to the rejected promo code", async () => {
    await render(<CheckoutPage />);
    await fillContact();
    await openPromo();
    await typeInto(textbox("Promo code"), "EXPIRED");
    const place = el(page.getByRole("button", { name: "Place order" }));
    await tabTo(place);
    await userEvent.keyboard("{Enter}");
    // Pending: the button stays focusable and focused (never dropped to <body>).
    let onBody = 0;
    for (
      let i = 0;
      i < 40 && page.getByText("This code has expired.").elements().length === 0;
      i++
    ) {
      if (document.activeElement === document.body) onBody += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(onBody).toBe(0);
    await expect.element(page.getByText("This code has expired.")).toBeVisible();
    await expect.poll(() => document.activeElement).toBe(el(textbox("Promo code")));
    expect(document.activeElement?.getAttribute("aria-invalid")).toBe("true");
  });

  it("focuses the rejected promo code even when its panel was closed at submit", async () => {
    await render(<CheckoutPage />);
    await fillContact();
    await openPromo();
    await typeInto(textbox("Promo code"), "EXPIRED");
    const trigger = page.getByRole("button", { name: "Promo code", exact: true });
    await tabTo(el(trigger));
    await userEvent.keyboard("{Enter}");
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
    await tabTo(el(page.getByRole("button", { name: "Place order" })));
    await userEvent.keyboard("{Enter}");
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
    await expect.element(page.getByText("This code has expired.")).toBeVisible();
    await expect.poll(() => document.activeElement).toBe(el(textbox("Promo code")));
  });

  it("keeps the one-shot focus when the promo panel is closed while the order is pending", async () => {
    const server = holdServer();
    await render(<CheckoutPage />);
    await fillContact();
    await openPromo();
    await typeInto(textbox("Promo code"), "EXPIRED");
    const trigger = page.getByRole("button", { name: "Promo code", exact: true });
    await tabTo(el(placeOrder()));
    await userEvent.keyboard("{Enter}");
    await expect.element(placeOrder()).toHaveAttribute("aria-busy", "true");
    expect(server.held()).toBe(1);
    // Pending: the close request must not clear the errors that are set later.
    await trigger.click();
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
    server.release();
    await expect.element(page.getByText("This code has expired.")).toBeVisible();
    await expect.poll(() => document.activeElement).toBe(el(textbox("Promo code")));
    expect(document.activeElement?.getAttribute("aria-invalid")).toBe("true");
  });

  it("ignores Enter and the Apply button in the promo code while the order is pending", async () => {
    const server = holdServer();
    await render(<CheckoutPage />);
    await fillContact();
    await openPromo();
    await typeInto(textbox("Promo code"), "SAVE10");
    await tabTo(el(placeOrder()));
    await userEvent.keyboard("{Enter}");
    await expect.element(placeOrder()).toHaveAttribute("aria-busy", "true");
    expect(server.held()).toBe(1);
    (el(textbox("Promo code")) as HTMLInputElement).focus();
    await userEvent.keyboard("{Enter}");
    await page.getByRole("button", { name: "Apply" }).click();
    // Neither started an Apply: the only server call waiting is the order's own.
    expect(server.held()).toBe(1);
    server.release();
    await expect.element(page.getByText("Order placed")).toBeVisible();
    expect(page.getByText("Code applied.").elements()).toHaveLength(0);
  });

  it("ignores Enter while an IME is composing (isComposing or keyCode 229)", async () => {
    const server = holdServer();
    await render(<CheckoutPage />);
    await openPromo();
    await typeInto(textbox("Promo code"), "EXPIRED");
    const input = el(textbox("Promo code"));
    const enter = (init: KeyboardEventInit & { keyCode?: number }) => {
      const event = new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
        ...init,
      });
      input.dispatchEvent(event);
      return event;
    };
    expect(enter({ isComposing: true }).defaultPrevented).toBe(false);
    expect(enter({ keyCode: 229 }).defaultPrevented).toBe(false);
    expect(server.held()).toBe(0);
    // A plain Enter is an Apply.
    expect(enter({}).defaultPrevented).toBe(true);
    expect(server.held()).toBe(1);
    server.release();
    await expect.element(page.getByText("This code has expired.")).toBeVisible();
  });

  it("hides a rejected code's error with the panel and shows it again on the next submit", async () => {
    await render(<CheckoutPage />);
    await fillContact();
    await openPromo();
    await typeInto(textbox("Promo code"), "EXPIRED");
    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByText("This code has expired.")).toBeVisible();
    const trigger = page.getByRole("button", { name: "Promo code", exact: true });
    const place = page.getByRole("button", { name: "Place order" });
    await tabTo(el(trigger));
    await userEvent.keyboard("{Enter}");
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.keyboard("{Enter}");
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
    expect(page.getByText("This code has expired.").elements()).toHaveLength(0);
    await expect.element(textbox("Promo code")).not.toHaveAttribute("aria-invalid", "true");
    // Submitting re-checks the code, and the error is back.
    await tabTo(el(place));
    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByText("This code has expired.")).toBeVisible();
    // Closing the panel drops the error again; the next submit reopens it.
    await tabTo(el(trigger));
    await userEvent.keyboard("{Enter}");
    await expect.element(trigger).toHaveAttribute("aria-expanded", "false");
    await tabTo(el(place));
    await userEvent.keyboard("{Enter}");
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
    await expect.element(page.getByText("This code has expired.")).toBeVisible();
  });

  it("adds gift wrap to the total when selected", async () => {
    await render(<CheckoutPage />);
    await expect.element(page.getByText("€75.00", { exact: true })).toBeVisible();
    const gift = page.getByRole("checkbox", { name: /^Gift wrap/ });
    await tabTo(el(gift));
    await userEvent.keyboard(" ");
    await expect.element(page.getByText("€78.00", { exact: true })).toBeVisible();
    await expect.element(page.getByText("€3.00", { exact: true })).toBeVisible();
    await userEvent.keyboard(" ");
    await expect.element(page.getByText("€75.00", { exact: true })).toBeVisible();
    expect(page.getByText("€78.00", { exact: true }).elements()).toHaveLength(0);
  });

  it("places the order when the code is fine", async () => {
    await render(<CheckoutPage />);
    await fillContact();
    await tabTo(el(page.getByRole("button", { name: "Place order" })));
    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByText("Order placed")).toBeVisible();
  });

  it("requires the contact fields", async () => {
    await render(<CheckoutPage />);
    await tabTo(el(page.getByRole("button", { name: "Place order" })));
    await userEvent.keyboard("{Enter}");
    await expect.element(textbox("Full name")).toHaveAttribute("aria-invalid", "true");
    expect(page.getByText("Order placed").elements()).toHaveLength(0);
  });

  it("verifies the phone: Send code reveals the OTP field; typing completes it", async () => {
    await render(<CheckoutPage />);
    await tabTo(el(page.getByRole("button", { name: "Send code" })));
    await userEvent.keyboard("{Enter}");
    const first = textbox("Verification code");
    await expect.element(first).toBeVisible();
    expect(document.querySelectorAll("[data-slot=otp-field-input]")).toHaveLength(6);
    expect(page.getByText("Phone verified").elements()).toHaveLength(0);
    await tabTo(el(first));
    await userEvent.keyboard("123456");
    await expect.element(page.getByText("Phone verified")).toBeVisible();
  });

  it("drops Phone verified when the code changes or is resent", async () => {
    await render(<CheckoutPage />);
    const send = page.getByRole("button", { name: /^(Send|Resend) code$/ });
    await tabTo(el(send));
    await userEvent.keyboard("{Enter}");
    const first = textbox("Verification code");
    await tabTo(el(first));
    await userEvent.keyboard("123456");
    await expect.element(page.getByText("Phone verified")).toBeVisible();
    await userEvent.keyboard("{Backspace}");
    await expect.poll(() => page.getByText("Phone verified").elements().length).toBe(0);
    // Resending sends a fresh code: the old digits are cleared and the field starts over.
    await tabTo(el(send));
    await userEvent.keyboard("{Enter}");
    await tabTo(el(first));
    await userEvent.keyboard("654321");
    await expect.element(page.getByText("Phone verified")).toBeVisible();
    await tabTo(el(send));
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => page.getByText("Phone verified").elements().length).toBe(0);
    for (const input of document.querySelectorAll<HTMLInputElement>("[data-slot=otp-field-input]"))
      expect(input.value).toBe("");
  });

  it("verifies the phone by paste", async () => {
    await render(<CheckoutPage />);
    await tabTo(el(page.getByRole("button", { name: "Send code" })));
    await userEvent.keyboard("{Enter}");
    const first = el(textbox("Verification code")) as HTMLElement;
    first.focus();
    const data = new DataTransfer();
    data.setData("text/plain", "654321");
    first.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
    );
    await expect.element(page.getByText("Phone verified")).toBeVisible();
  });

  it("opens the summary's item list", async () => {
    await render(<CheckoutPage />);
    const trigger = page.getByRole("button", { name: "Show items" });
    expect(page.getByText("Canvas sneakers").elements()).toHaveLength(0);
    await tabTo(el(trigger));
    await userEvent.keyboard(" ");
    await expect.element(trigger).toHaveAttribute("aria-expanded", "true");
    await expect.element(page.getByText("Canvas sneakers")).toBeVisible();
  });

  describe.each(["light", "dark"] as const)("axe (%s)", (theme) => {
    const setup = async () => {
      if (theme === "dark") document.documentElement.classList.add("dark");
      await render(
        <div className="bg-background p-4">
          <CheckoutPage />
        </div>,
      );
    };
    const finish = () => document.documentElement.classList.remove("dark");

    it("has no violations with everything closed", async () => {
      try {
        await setup();
        await expect.poll(() => document.getAnimations().length).toBe(0);
        const { violations, incomplete } = await auditOpenOverlay();
        expect(violations).toEqual([]);
        expect(incomplete).toEqual([]);
      } finally {
        finish();
      }
    });

    it("has no violations with the promo, OTP and item panels open", async () => {
      try {
        await setup();
        await userEvent.click(page.getByRole("button", { name: "Send code" }));
        await userEvent.click(page.getByRole("button", { name: "Promo code", exact: true }));
        await userEvent.click(page.getByRole("button", { name: "Show items" }));
        await expect.element(page.getByText("Canvas sneakers")).toBeVisible();
        await expect.poll(() => document.getAnimations().length).toBe(0);
        const { violations, incomplete } = await auditOpenOverlay();
        expect(violations).toEqual([]);
        expect(incomplete).toEqual([]);
      } finally {
        finish();
      }
    });

    it("has no violations with the navigation panel open", async () => {
      try {
        await setup();
        await userEvent.click(page.getByRole("button", { name: "Shop" }));
        await expect.element(page.getByRole("link", { name: /Sneakers/ })).toBeVisible();
        await waitForPopupSettled(popup() as HTMLElement);
        await expect.poll(() => document.getAnimations().length).toBe(0);
        // The panel covers part of the page, and axe cannot decide the contrast of text it
        // partly hides. The page itself is audited in the closed test; hide it here.
        const main = document.querySelector<HTMLElement>("main") as HTMLElement;
        main.style.visibility = "hidden";
        const { violations, incomplete } = await auditOpenOverlay();
        expect(violations).toEqual([]);
        expect(incomplete).toEqual([]);
      } finally {
        finish();
      }
    });

    it("has no violations with the city suggestions open", async () => {
      try {
        await setup();
        const field = combobox("City").element().closest("[data-slot=field]") as HTMLElement;
        await typeInto(combobox("City"), "b");
        await expect.element(page.getByRole("option").first()).toBeVisible();
        const content = document.querySelector<HTMLElement>("[data-slot=autocomplete-content]");
        await waitForPopupSettled(content as HTMLElement);
        await expect.poll(() => document.getAnimations().length).toBe(0);
        // With the input outside the popup, Base UI treats the list as modal: it marks the rest of
        // the page aria-hidden while that page's buttons and inputs stay focusable (focus is kept in
        // the input). That upstream behaviour is all `aria-hidden-focus` can flag, and the popup
        // covers page text. Both are page-level; the page is audited closed above. Here only the
        // City field stays rendered.
        for (const part of document.querySelectorAll<HTMLElement>("header, main"))
          part.style.visibility = "hidden";
        field.style.visibility = "visible";
        // The list opens over the field's description.
        for (const note of field.querySelectorAll<HTMLElement>("[data-slot=field-description]"))
          note.style.visibility = "hidden";
        const { violations, incomplete } = await auditOpenOverlay();
        expect(violations).toEqual([]);
        expect(incomplete).toEqual([]);
      } finally {
        finish();
      }
    });
  });
});
