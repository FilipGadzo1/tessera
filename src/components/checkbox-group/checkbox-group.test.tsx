import axe from "axe-core";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Checkbox } from "../checkbox";
import { Field, FieldItem, FieldLabel } from "../field";
import { Fieldset, FieldsetLegend } from "../fieldset";
import { Label } from "../label";
import { CheckboxGroup, type CheckboxGroupProps } from "./checkbox-group";

const fruits = ["fuji", "gala", "granny"];
const fruitNames = ["Fuji", "Gala", "Granny Smith"];

function Row({ value, name, children }: { value?: string; name?: string; children: string }) {
  return (
    <Label className="flex items-center gap-2">
      <Checkbox value={value} name={name} parent={value === undefined} />
      {children}
    </Label>
  );
}

function Apples(props: CheckboxGroupProps) {
  return (
    <CheckboxGroup aria-label="Apples" {...props}>
      <Row value="fuji" name="apple">
        Fuji
      </Row>
      <Row value="gala" name="apple">
        Gala
      </Row>
      <Row value="granny" name="apple">
        Granny Smith
      </Row>
    </CheckboxGroup>
  );
}

function ParentGroup() {
  const [value, setValue] = useState<string[]>([]);
  return (
    <CheckboxGroup aria-label="Apples" value={value} onValueChange={setValue} allValues={fruits}>
      <Row>All apples</Row>
      <Row value="fuji">Fuji</Row>
      <Row value="gala">Gala</Row>
      <Row value="granny">Granny Smith</Row>
    </CheckboxGroup>
  );
}

afterEach(() => {
  document.documentElement.classList.remove("dark");
});

describe("CheckboxGroup", () => {
  it("renders a group with data-slot, flex-col gap-3 and its label", async () => {
    const screen = await render(<Apples />);
    const group = screen.getByRole("group", { name: "Apples" });
    await expect.element(group).toHaveAttribute("data-slot", "checkbox-group");
    const style = getComputedStyle(group.element());
    expect(style.display).toBe("flex");
    expect(style.flexDirection).toBe("column");
    expect(style.rowGap).toBe("12px");
  });

  it("merges className, so flex-row lays the group out in a row", async () => {
    const screen = await render(<Apples className="flex-row" />);
    const group = screen.getByRole("group", { name: "Apples" }).element();
    expect(getComputedStyle(group).flexDirection).toBe("row");
  });

  it("reports value changes and toggles Tessera Checkboxes (uncontrolled)", async () => {
    const onValueChange = vi.fn();
    const screen = await render(<Apples defaultValue={["gala"]} onValueChange={onValueChange} />);
    const fuji = screen.getByRole("checkbox", { name: "Fuji" });
    const gala = screen.getByRole("checkbox", { name: "Gala" });
    await expect.element(gala).toHaveAttribute("aria-checked", "true");
    await expect.element(fuji).toHaveAttribute("aria-checked", "false");
    await fuji.click();
    expect(onValueChange).toHaveBeenLastCalledWith(["gala", "fuji"], expect.anything());
    await gala.click();
    expect(onValueChange).toHaveBeenLastCalledWith(["fuji"], expect.anything());
    await expect.element(gala).toHaveAttribute("aria-checked", "false");
  });

  it("disables every checkbox with disabled", async () => {
    const screen = await render(<Apples disabled />);
    for (const name of fruitNames) {
      await expect.element(screen.getByRole("checkbox", { name })).toHaveAttribute("data-disabled");
    }
  });

  it("supports a parent Checkbox: indeterminate when partly checked, toggles all", async () => {
    const screen = await render(<ParentGroup />);
    const parent = screen.getByRole("checkbox", { name: "All apples" });
    await expect.element(parent).toHaveAttribute("aria-checked", "false");
    await screen.getByRole("checkbox", { name: "Fuji" }).click();
    await expect.element(parent).toHaveAttribute("aria-checked", "mixed");
    await expect.element(parent).toHaveAttribute("data-indeterminate");
    const icon = parent.element().querySelector('[data-slot="checkbox-indicator"] svg');
    expect(icon?.getAttribute("data-icon")).toBe("dash");
    await parent.click();
    for (const name of fruitNames) {
      await expect
        .element(screen.getByRole("checkbox", { name }))
        .toHaveAttribute("aria-checked", "true");
    }
    await expect.element(parent).toHaveAttribute("aria-checked", "true");
    await parent.click();
    for (const name of fruitNames) {
      await expect
        .element(screen.getByRole("checkbox", { name }))
        .toHaveAttribute("aria-checked", "false");
    }
    await expect.element(parent).toHaveAttribute("aria-checked", "false");
  });

  it("submits the checked values under each checkbox name in a native form", async () => {
    const screen = await render(
      <form data-testid="form">
        <Apples defaultValue={["fuji", "granny"]} />
      </form>,
    );
    const form = screen.getByTestId("form").element() as HTMLFormElement;
    expect(new FormData(form).getAll("apple")).toEqual(["fuji", "granny"]);
    await screen.getByRole("checkbox", { name: "Gala" }).click();
    expect(new FormData(form).getAll("apple").sort()).toEqual(["fuji", "gala", "granny"]);
    await screen.getByRole("checkbox", { name: "Fuji" }).click();
    expect(new FormData(form).getAll("apple").sort()).toEqual(["gala", "granny"]);
  });

  it("works inside Fieldset + FieldsetLegend, which names the group", async () => {
    const screen = await render(
      <Fieldset render={<CheckboxGroup defaultValue={["email"]} />}>
        <FieldsetLegend>Notify me by</FieldsetLegend>
        <Label className="flex items-center gap-2">
          <Checkbox value="email" />
          Email
        </Label>
        <Label className="flex items-center gap-2">
          <Checkbox value="sms" />
          SMS
        </Label>
      </Fieldset>,
    );
    const group = screen.getByRole("group", { name: "Notify me by" });
    await expect.element(group).toBeInTheDocument();
    await screen.getByRole("checkbox", { name: "SMS" }).click();
    await expect
      .element(screen.getByRole("checkbox", { name: "SMS" }))
      .toHaveAttribute("aria-checked", "true");
    await expect
      .element(screen.getByRole("checkbox", { name: "Email" }))
      .toHaveAttribute("aria-checked", "true");
  });

  it("works inside Field with a FieldItem + FieldLabel per option, and submits under the Field name", async () => {
    const screen = await render(
      <form data-testid="form">
        <Field name="protocols">
          <Fieldset render={<CheckboxGroup />}>
            <FieldsetLegend>Protocols</FieldsetLegend>
            <FieldItem>
              <FieldLabel className="flex items-center gap-2">
                <Checkbox value="http" />
                HTTP
              </FieldLabel>
            </FieldItem>
            <FieldItem>
              <FieldLabel className="flex items-center gap-2">
                <Checkbox value="ssh" />
                SSH
              </FieldLabel>
            </FieldItem>
          </Fieldset>
        </Field>
      </form>,
    );
    await expect.element(screen.getByRole("group", { name: "Protocols" })).toBeInTheDocument();
    await screen.getByRole("checkbox", { name: "SSH" }).click();
    await screen.getByRole("checkbox", { name: "HTTP" }).click();
    const form = screen.getByTestId("form").element() as HTMLFormElement;
    expect(new FormData(form).getAll("protocols").sort()).toEqual(["http", "ssh"]);
  });

  it("moves through the checkboxes with Tab and toggles with Space", async () => {
    const screen = await render(<Apples />);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("checkbox", { name: "Fuji" }).element());
    await userEvent.keyboard(" ");
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("checkbox", { name: "Gala" }).element());
    await expect
      .element(screen.getByRole("checkbox", { name: "Fuji" }))
      .toHaveAttribute("aria-checked", "true");
  });

  it.each(["light", "dark"] as const)("has no axe violations in the %s theme", async (theme) => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    const screen = await render(
      <div className="flex flex-col gap-6 bg-background p-4 text-foreground">
        <ParentGroup />
        <Fieldset render={<CheckboxGroup defaultValue={["email"]} />}>
          <FieldsetLegend>Notify me by</FieldsetLegend>
          <Label className="flex items-center gap-2">
            <Checkbox value="email" />
            Email
          </Label>
          <Label className="flex items-center gap-2">
            <Checkbox value="sms" disabled />
            SMS
          </Label>
        </Fieldset>
      </div>,
    );
    const results = await axe.run(screen.container);
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.incomplete.map((v) => `${v.id}: ${v.nodes.map((n) => n.target)}`)).toEqual([]);
  });
});
