"use client";

import { useState } from "react";
import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from "../../components/autocomplete";
import { Badge } from "../../components/badge";
import { Button } from "../../components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/card";
import { Checkbox } from "../../components/checkbox";
import { CheckboxGroup } from "../../components/checkbox-group";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "../../components/collapsible";
import { Field, FieldDescription, FieldError, FieldItem, FieldLabel } from "../../components/field";
import { Fieldset, FieldsetLegend } from "../../components/fieldset";
import { Form, type FormProps } from "../../components/form";
import { Input } from "../../components/input";
import { Label } from "../../components/label";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "../../components/navigation-menu";
import { OTPField } from "../../components/otp-field";
import { Separator } from "../../components/separator";
import { ChevronDownIcon } from "../../lib/icons";

const cities = [
  "Amsterdam",
  "Barcelona",
  "Berlin",
  "Bern",
  "Brussels",
  "Copenhagen",
  "Lisbon",
  "Madrid",
  "Paris",
  "Prague",
  "Vienna",
  "Zagreb",
  "Zurich",
];

const shopLinks = [
  { href: "#sneakers", title: "Sneakers", description: "Canvas and leather, all sizes." },
  { href: "#boots", title: "Boots", description: "Waterproof and lined." },
  { href: "#sandals", title: "Sandals", description: "Light and quick to dry." },
  { href: "#accessories", title: "Accessories", description: "Laces, insoles and care." },
];

const helpLinks = [
  { href: "#shipping", title: "Shipping", description: "Costs and delivery times." },
  { href: "#returns", title: "Returns", description: "Free within 30 days." },
];

const deliveryOptions = [
  { value: "gift", label: "Gift wrap", note: "+€3.00" },
  { value: "door", label: "Leave at door", note: "" },
  { value: "signature", label: "Signature on delivery", note: "" },
];

const deliveryValues = deliveryOptions.map((option) => option.value);

const items = [
  { name: "Canvas sneakers", detail: "Size 42, white", price: 59 },
  { name: "Wool socks", detail: "Pack of 3", price: 12 },
];

const shipping = 4;
const giftWrapPrice = 3;

const money = (amount: number) => `€${amount.toFixed(2)}`;

/** The fake server: one promo code is rejected, everything else is fine. */
async function checkPromo(code: string): Promise<string | null> {
  await new Promise((resolve) => setTimeout(resolve, 250));
  return code.trim().toUpperCase() === "EXPIRED" ? "This code has expired." : null;
}

function SiteHeader() {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-border pb-3">
      <span className="text-lg font-semibold">Stride</span>
      <NavigationMenu aria-label="Main">
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger>Shop</NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="grid gap-1 sm:grid-cols-2">
                {shopLinks.map((link) => (
                  <li key={link.href}>
                    <NavigationMenuLink href={link.href}>
                      <span className="block font-medium">{link.title}</span>
                      <span className="mt-1 block text-muted-foreground">{link.description}</span>
                    </NavigationMenuLink>
                  </li>
                ))}
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuTrigger>Help</NavigationMenuTrigger>
            <NavigationMenuContent className="sm:w-72">
              <ul className="flex flex-col gap-1">
                {helpLinks.map((link) => (
                  <li key={link.href}>
                    <NavigationMenuLink href={link.href}>
                      <span className="block font-medium">{link.title}</span>
                      <span className="mt-1 block text-muted-foreground">{link.description}</span>
                    </NavigationMenuLink>
                  </li>
                ))}
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <NavigationMenuLink href="#orders">Orders</NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </header>
  );
}

function ContactSection({
  verified,
  onVerifiedChange,
}: {
  verified: boolean;
  onVerifiedChange: (verified: boolean) => void;
}) {
  // Counts the codes sent; a new code remounts the OTPField so the old digits are cleared.
  const [codesSent, setCodesSent] = useState(0);
  const codeSent = codesSent > 0;
  return (
    <section aria-labelledby="checkout-contact" className="flex flex-col gap-4">
      <h2 id="checkout-contact" className="text-base font-semibold">
        Contact
      </h2>
      <Field name="name">
        <FieldLabel>Full name</FieldLabel>
        <Input required autoComplete="name" />
        <FieldError />
      </Field>
      <Field name="email">
        <FieldLabel>Email</FieldLabel>
        <Input required type="email" autoComplete="email" />
        <FieldError />
      </Field>
      <div className="flex flex-col gap-3">
        <Field name="phone">
          <FieldLabel>Phone</FieldLabel>
          <div className="flex gap-2">
            <Input type="tel" autoComplete="tel" placeholder="+385 91 234 5678" />
            <Button
              type="button"
              variant="outline"
              color="neutral"
              onClick={() => {
                setCodesSent((count) => count + 1);
                onVerifiedChange(false);
              }}
            >
              {codeSent ? "Resend code" : "Send code"}
            </Button>
          </div>
          <FieldDescription>We text a 6-digit code to confirm the number.</FieldDescription>
        </Field>
        {codeSent && (
          <Field name="code">
            <FieldLabel>Verification code</FieldLabel>
            <OTPField
              key={codesSent}
              length={6}
              groups={[3, 3]}
              onValueChange={() => onVerifiedChange(false)}
              onValueComplete={() => onVerifiedChange(true)}
            />
            {verified && (
              <Badge color="success" className="w-fit">
                Phone verified
              </Badge>
            )}
          </Field>
        )}
      </div>
    </section>
  );
}

function ShippingSection({
  delivery,
  onDeliveryChange,
}: {
  delivery: string[];
  onDeliveryChange: (value: string[]) => void;
}) {
  return (
    <section aria-labelledby="checkout-shipping" className="flex flex-col gap-4">
      <h2 id="checkout-shipping" className="text-base font-semibold">
        Shipping
      </h2>
      <Field name="city">
        <FieldLabel>City</FieldLabel>
        <Autocomplete items={cities}>
          <AutocompleteInput placeholder="Start typing a city" showClear />
          <AutocompleteContent>
            <AutocompleteEmpty>No suggestions. Any city works.</AutocompleteEmpty>
            <AutocompleteList>
              {(city: string) => (
                <AutocompleteItem key={city} value={city}>
                  {city}
                </AutocompleteItem>
              )}
            </AutocompleteList>
          </AutocompleteContent>
        </Autocomplete>
        <FieldDescription>Suggestions only: type any city you like.</FieldDescription>
      </Field>
      <Field name="delivery">
        <Fieldset
          render={
            <CheckboxGroup
              value={delivery}
              onValueChange={onDeliveryChange}
              allValues={deliveryValues}
            />
          }
        >
          <FieldsetLegend>Delivery options</FieldsetLegend>
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox parent />
            Select all
          </Label>
          <div className="flex flex-col gap-3 pl-6">
            {deliveryOptions.map((option) => (
              <FieldItem key={option.value}>
                <FieldLabel className="flex items-center gap-2">
                  <Checkbox value={option.value} />
                  {option.label}
                  {option.note && (
                    <span className="font-normal text-muted-foreground">{option.note}</span>
                  )}
                </FieldLabel>
              </FieldItem>
            ))}
          </div>
        </Fieldset>
      </Field>
    </section>
  );
}

function PromoSection({
  open,
  onOpenChange,
  promo,
  onPromoChange,
  onApply,
  applied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promo: string;
  onPromoChange: (value: string) => void;
  onApply: () => void;
  applied: boolean;
}) {
  return (
    <Collapsible className="flex flex-col gap-2" open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger
        render={<Button variant="ghost" color="neutral" className="group w-fit -ml-4" />}
      >
        Promo code
        <ChevronDownIcon className="transition-transform duration-200 group-data-panel-open:rotate-180 motion-reduce:transition-none" />
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <Field name="promo" className="pt-1">
          <FieldLabel>Promo code</FieldLabel>
          <div className="flex gap-2">
            <Input
              value={promo}
              onChange={(event) => onPromoChange(event.target.value)}
              onKeyDown={(event) => {
                // Enter applies the code; it does not place the whole order.
                if (event.key === "Enter") {
                  event.preventDefault();
                  onApply();
                }
              }}
            />
            <Button type="button" variant="outline" color="neutral" onClick={onApply}>
              Apply
            </Button>
          </div>
          <FieldDescription>Try EXPIRED to see the server reject a code.</FieldDescription>
          <FieldError />
          {applied && <p className="text-sm text-muted-foreground">Code applied.</p>}
        </Field>
      </CollapsiblePanel>
    </Collapsible>
  );
}

function OrderSummary({ giftWrap }: { giftWrap: boolean }) {
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const total = subtotal + shipping + (giftWrap ? giftWrapPrice : 0);
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>Order summary</CardTitle>
        <CardDescription>{items.length} items</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Collapsible className="flex flex-col gap-2">
          <CollapsibleTrigger
            render={<Button variant="ghost" color="neutral" className="group w-fit -ml-4" />}
          >
            Show items
            <ChevronDownIcon className="transition-transform duration-200 group-data-panel-open:rotate-180 motion-reduce:transition-none" />
          </CollapsibleTrigger>
          <CollapsiblePanel>
            <ul className="flex flex-col gap-3 text-sm">
              {items.map((item) => (
                <li key={item.name} className="flex justify-between gap-4">
                  <span>
                    <span className="block font-medium">{item.name}</span>
                    <span className="text-muted-foreground">{item.detail}</span>
                  </span>
                  <span>{money(item.price)}</span>
                </li>
              ))}
            </ul>
          </CollapsiblePanel>
        </Collapsible>
        <Separator />
        <dl className="grid grid-cols-2 gap-1 text-sm">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="text-right">{money(subtotal)}</dd>
          <dt className="text-muted-foreground">Shipping</dt>
          <dd className="text-right">{money(shipping)}</dd>
          {giftWrap && (
            <>
              <dt className="text-muted-foreground">Gift wrap</dt>
              <dd className="text-right">{money(giftWrapPrice)}</dd>
            </>
          )}
          <dt className="font-medium">Total</dt>
          <dd className="text-right font-medium">{money(total)}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}

/**
 * A checkout page composing the Phase G components: a NavigationMenu header, a Form with contact
 * Fields, an OTPField phone check, an Autocomplete city, a CheckboxGroup with a parent checkbox
 * and a Collapsible promo code, beside an order summary Card. A fake server rejects the promo
 * code "EXPIRED" through the Form's `errors`.
 */
export function CheckoutPage() {
  const [errors, setErrors] = useState<FormProps["errors"]>({});
  const [promo, setPromo] = useState("");
  const [applied, setApplied] = useState(false);
  const [verified, setVerified] = useState(false);
  const [delivery, setDelivery] = useState<string[]>([]);
  const [promoOpen, setPromoOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [placed, setPlaced] = useState(false);

  async function validatePromo() {
    // The errors are set once, with the result: Base UI's Form focuses the first invalid control
    // on the first `errors` change after a submit, so clearing them before the await would use
    // that up and leave focus where it was.
    setApplied(false);
    const error = promo ? await checkPromo(promo) : null;
    setErrors(error ? { promo: error } : {});
    // The error sits under the promo Field, so the panel must be open to show it.
    if (error) setPromoOpen(true);
    return error === null;
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <SiteHeader />
      <main className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">Checkout</h1>
        {placed && (
          <Card role="status">
            <CardHeader>
              <CardTitle>Order placed</CardTitle>
              <CardDescription>A receipt is on its way to your inbox.</CardDescription>
            </CardHeader>
          </Card>
        )}
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_18rem]">
          <Form
            aria-label="Checkout"
            className="flex flex-col gap-8"
            errors={errors}
            onFormSubmit={async () => {
              setPending(true);
              setPlaced(false);
              const ok = await validatePromo();
              setPending(false);
              if (ok) setPlaced(true);
            }}
          >
            <ContactSection verified={verified} onVerifiedChange={setVerified} />
            <ShippingSection delivery={delivery} onDeliveryChange={setDelivery} />
            <PromoSection
              open={promoOpen}
              onOpenChange={(open) => {
                setPromoOpen(open);
                // A closed panel hides its error, so drop it; the next submit brings it back.
                if (!open) setErrors({});
              }}
              promo={promo}
              onPromoChange={setPromo}
              applied={applied}
              onApply={async () => {
                const ok = await validatePromo();
                if (ok && promo) setApplied(true);
              }}
            />
            <Button type="submit" loading={pending} className="w-fit">
              Place order
            </Button>
          </Form>
          <OrderSummary giftWrap={delivery.includes("gift")} />
        </div>
      </main>
    </div>
  );
}
