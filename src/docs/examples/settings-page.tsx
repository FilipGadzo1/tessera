"use client";

import { useState } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "../../components/accordion";
import { Avatar, AvatarFallback } from "../../components/avatar";
import { Button } from "../../components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../components/card";
import { Field, FieldDescription, FieldLabel } from "../../components/field";
import { Input } from "../../components/input";
import { Label } from "../../components/label";
import { Progress, ProgressLabel, ProgressValue } from "../../components/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/select";
import { Separator } from "../../components/separator";
import { Switch } from "../../components/switch";
import { Tabs, TabsList, TabsPanel, TabsTab } from "../../components/tabs";
import { Toaster, useToast } from "../../components/toast";

const languages = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  ja: "日本語",
};
type Language = keyof typeof languages;

const channels = [
  {
    value: "email",
    label: "Email",
    options: [
      { key: "digest", label: "Weekly digest", hint: "A summary every Monday morning." },
      { key: "product", label: "Product updates", hint: "New features, about once a month." },
      { key: "security", label: "Security alerts", hint: "New sign-ins and password changes." },
    ],
  },
  {
    value: "push",
    label: "Push",
    options: [
      { key: "mentions", label: "Mentions and replies", hint: "When someone @mentions you." },
      { key: "reviews", label: "Review requests", hint: "When you are asked to review a change." },
    ],
  },
  {
    value: "sms",
    label: "SMS",
    options: [{ key: "codes", label: "Sign-in codes", hint: "Standard message rates may apply." }],
  },
] as const;
type NotificationKey = (typeof channels)[number]["options"][number]["key"];

const initialNotifications: Record<NotificationKey, boolean> = {
  digest: true,
  product: false,
  security: true,
  mentions: true,
  reviews: false,
  codes: true,
};

/**
 * Example only (not exported from the library): an account settings card composing the Phase D
 * components. Tabs switch between Profile (Avatar, Field + Input, Select), Notifications (an
 * Accordion of channels holding Switches) and Billing (Progress, Separator); "Save changes" shows a
 * success toast.
 */
export function SettingsPage() {
  return (
    <Toaster>
      <SettingsCard />
    </Toaster>
  );
}

function SettingsCard() {
  const toast = useToast();
  const [language, setLanguage] = useState<Language>("en");
  const [notifications, setNotifications] = useState(initialNotifications);

  function save() {
    const on = Object.values(notifications).filter(Boolean).length;
    const total = Object.keys(notifications).length;
    toast.add({
      title: "Settings saved",
      description: `Language: ${languages[language]} · ${on} of ${total} notifications on.`,
      type: "success",
    });
  }

  return (
    <Card className="w-[36rem] max-w-full">
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Settings
        </CardTitle>
        <CardDescription>Manage your profile, notifications and billing.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* keepMounted: switching tabs keeps each panel's uncontrolled fields and open channels. */}
        <Tabs defaultValue="profile">
          <TabsList aria-label="Settings sections">
            <TabsTab value="profile">Profile</TabsTab>
            <TabsTab value="notifications">Notifications</TabsTab>
            <TabsTab value="billing">Billing</TabsTab>
          </TabsList>

          <TabsPanel value="profile" keepMounted className="flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <Avatar size="lg">
                <AvatarFallback>AL</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <span className="font-medium text-sm">Ada Lovelace</span>
                <span className="text-muted-foreground text-sm">Admin · Analytical Engines</span>
              </div>
            </div>
            <Field>
              <FieldLabel>Display name</FieldLabel>
              <Input defaultValue="Ada Lovelace" autoComplete="name" />
            </Field>
            <Field>
              <FieldLabel>Email</FieldLabel>
              <Input
                type="email"
                defaultValue="ada@example.com"
                autoComplete="email"
                spellCheck={false}
              />
            </Field>
            <Field>
              <FieldLabel>Language</FieldLabel>
              <Select
                items={languages}
                value={language}
                onValueChange={(value) => value && setLanguage(value as Language)}
              >
                <SelectTrigger className="w-56 max-w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(languages).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>Used for emails and the interface.</FieldDescription>
            </Field>
          </TabsPanel>

          <TabsPanel value="notifications" keepMounted>
            <Accordion multiple defaultValue={["email"]}>
              {channels.map((channel) => (
                <AccordionItem key={channel.value} value={channel.value}>
                  <AccordionTrigger>{channel.label}</AccordionTrigger>
                  <AccordionPanel>
                    <div className="flex flex-col gap-4 pb-4">
                      {channel.options.map((option) => (
                        <div key={option.key} className="flex items-center justify-between gap-4">
                          <div className="flex flex-col gap-0.5">
                            <Label htmlFor={`notify-${option.key}`}>{option.label}</Label>
                            <span
                              id={`notify-${option.key}-hint`}
                              className="text-muted-foreground text-sm"
                            >
                              {option.hint}
                            </span>
                          </div>
                          <Switch
                            id={`notify-${option.key}`}
                            aria-describedby={`notify-${option.key}-hint`}
                            checked={notifications[option.key]}
                            onCheckedChange={(checked) =>
                              setNotifications((current) => ({
                                ...current,
                                [option.key]: checked,
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </AccordionPanel>
                </AccordionItem>
              ))}
            </Accordion>
          </TabsPanel>

          <TabsPanel value="billing" keepMounted className="flex flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <h3 className="font-medium text-sm">Team plan</h3>
                <p className="text-muted-foreground text-sm">
                  €12 per seat a month · renews on 1 October
                </p>
              </div>
              <Button size="sm" variant="outline" color="neutral">
                Change plan
              </Button>
            </div>
            <Separator />
            <div className="flex flex-col gap-4">
              <Progress
                value={32.4}
                max={50}
                format={{ style: "unit", unit: "gigabyte", maximumFractionDigits: 1 }}
              >
                <ProgressLabel>Storage</ProgressLabel>
                <ProgressValue>{(formatted) => `${formatted} of 50 GB`}</ProgressValue>
              </Progress>
              <Progress value={7} max={10} color="info">
                <ProgressLabel>Seats</ProgressLabel>
                <ProgressValue>{(_formatted, value) => `${value} of 10 used`}</ProgressValue>
              </Progress>
            </div>
            <Separator />
            <p className="text-muted-foreground text-sm">
              Invoices go to billing@example.com on the first of each month.
            </p>
          </TabsPanel>
        </Tabs>
      </CardContent>
      <CardFooter className="justify-end">
        <Button onClick={save}>Save changes</Button>
      </CardFooter>
    </Card>
  );
}
