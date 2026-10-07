"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { Badge } from "../../components/badge";
import { Button } from "../../components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/card";
import { ColorPicker, ColorPickerPopover } from "../../components/color-picker";
import { Field, FieldItem, FieldLabel } from "../../components/field";
import { Fieldset, FieldsetLegend } from "../../components/fieldset";
import { Input } from "../../components/input";
import { KbdShortcut } from "../../components/kbd";
import { Label } from "../../components/label";
import { Radio, RadioGroup } from "../../components/radio-group";
import { Rating } from "../../components/rating";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../../components/resizable";
import { Slider, SliderLabel, SliderValue } from "../../components/slider";
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "../../components/stepper";
import { Switch } from "../../components/switch";
import { toggleFocusClasses } from "../../lib/focus-classes";
import { matchesShortcut, parseShortcut } from "../../lib/modifier-key";
import { useModifierKeyLabel } from "../../lib/use-modifier-key-label";
import {
  contrastLabel,
  type Density,
  defaultTheme,
  densities,
  densityStyles,
  previewStyle,
  primaryContrast,
  primarySwatches,
  steps,
  type Theme,
  themeCss,
} from "./theme-studio-data";

const SAVE = "mod+s";
const TOGGLE_CODE = "mod+j";
const saveKeys = parseShortcut(SAVE);
const toggleCodeKeys = parseShortcut(TOGGLE_CODE);
const contrastMessage = "The primary colour needs 4.5:1 against the surface";

/** True below Tailwind's `md` breakpoint (768px): the panels stack. */
function useNarrow() {
  const query = "(max-width: 767.98px)";
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

type Update = (patch: Partial<Theme>) => void;

const headingClasses = "text-base font-semibold";

function ColorsStep({
  theme,
  update,
  showError,
  errorId,
}: {
  theme: Theme;
  update: Update;
  showError: boolean;
  errorId: string;
}) {
  const { ratio, aa } = primaryContrast(theme);
  return (
    <div className="flex flex-col gap-5">
      {/* The gate sits with the heading, so it stays in view above the pickers. */}
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={headingClasses}>Colors</h2>
          <Badge data-contrast={aa ? "aa" : "fails"} color={aa ? "success" : "danger"}>
            {contrastLabel(ratio, aa)}
          </Badge>
        </div>
        <div role="alert">
          {showError && (
            <p id={errorId} className="text-sm text-danger">
              {contrastMessage}
            </p>
          )}
        </div>
      </div>
      <Field>
        <FieldLabel>Primary colour</FieldLabel>
        <ColorPicker
          value={theme.primary}
          onValueChange={(primary) => update({ primary })}
          swatches={primarySwatches}
        />
      </Field>
      <Field>
        <FieldLabel>Surface colour</FieldLabel>
        <ColorPickerPopover
          value={theme.surface}
          onValueChange={(surface) => update({ surface })}
          className="w-fit"
        />
      </Field>
    </div>
  );
}

function ShapeStep({ theme, update }: { theme: Theme; update: Update }) {
  return (
    <div className="flex flex-col gap-6">
      <h2 className={headingClasses}>Shape</h2>
      <Slider
        value={theme.radius}
        onValueChange={(radius) => update({ radius: radius as number })}
        min={0}
        max={16}
      >
        <SliderLabel>Corner radius</SliderLabel>
        <SliderValue>{(formatted) => `${formatted[0]}px`}</SliderValue>
      </Slider>
      <Field>
        <Fieldset
          render={
            <RadioGroup
              value={theme.density}
              onValueChange={(density) => update({ density: density as Density })}
            />
          }
        >
          <FieldsetLegend>Density</FieldsetLegend>
          {densities.map((density) => (
            <FieldItem key={density.value}>
              <FieldLabel className="flex items-center gap-2">
                <Radio value={density.value} />
                {density.label}
              </FieldLabel>
            </FieldItem>
          ))}
        </Fieldset>
      </Field>
    </div>
  );
}

function ReviewStep({ theme, update }: { theme: Theme; update: Update }) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className={headingClasses}>Review</h2>
      <Field>
        <FieldLabel>Theme name</FieldLabel>
        <Input value={theme.name} onChange={(event) => update({ name: event.target.value })} />
      </Field>
      <Field>
        <FieldLabel>Rate this theme</FieldLabel>
        <Rating clearable value={theme.rating} onValueChange={(rating) => update({ rating })} />
      </Field>
    </div>
  );
}

/** The theme applied through inline custom properties on its own container. */
function Preview({ theme }: { theme: Theme }) {
  const density = densityStyles[theme.density];
  return (
    <section
      aria-label="Preview"
      data-slot="theme-preview"
      style={previewStyle(theme)}
      className="h-full overflow-auto bg-background p-6 text-foreground"
    >
      <Card className={density.gap}>
        <CardHeader>
          <CardTitle>{theme.name || "Untitled theme"}</CardTitle>
          <CardDescription>Every role below comes from the theme you are editing.</CardDescription>
        </CardHeader>
        <CardContent className={`flex flex-col ${density.gap}`}>
          <div className="flex flex-wrap gap-2">
            <Button size={density.button}>Get started</Button>
            <Button size={density.button} variant="soft">
              Learn more
            </Button>
            <Button size={density.button} variant="outline">
              Cancel
            </Button>
          </div>
          <p>
            Body text with a{" "}
            <span className="font-medium text-primary underline underline-offset-4">
              primary-coloured link
            </span>{" "}
            on the surface.
          </p>
          <Badge color="primary" className="self-start">
            New
          </Badge>
          <Field>
            <FieldLabel>Email</FieldLabel>
            <Input type="email" placeholder="you@example.com" />
          </Field>
          <div className="flex items-center gap-2">
            <Rating readOnly value={4.5} />
            <span className="text-muted-foreground">4.5 (24 reviews)</span>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function CodePanel({ theme }: { theme: Theme }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="flex h-full min-h-0 flex-col gap-2 p-4">
      <h2 id={titleId} className="text-sm font-semibold">
        Code
      </h2>
      <pre
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be reachable by keyboard.
        tabIndex={0}
        className={`min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 font-mono text-xs text-foreground ${toggleFocusClasses}`}
      >
        <code>{themeCss(theme)}</code>
      </pre>
    </section>
  );
}

/**
 * A theme editor composing the Phase J components: a Stepper wizard (Colors, Shape, Review) in a
 * collapsible Resizable controls panel, a live preview themed with inline custom properties, an
 * optional code panel, a contrast Badge from `color.ts` that gates the Colors step, and Ctrl/⌘+S
 * (save) and Ctrl/⌘+J (code panel) shortcuts with `KbdShortcut` hints.
 */
export function ThemeStudioPage({ onSave }: { onSave?: (theme: Theme) => void }) {
  const [theme, setTheme] = useState(defaultTheme);
  const [saved, setSaved] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [current, setCurrent] = useState(0);
  // The page remembers completion itself, so going Back keeps the later steps reachable.
  const [completed, setCompleted] = useState<ReadonlySet<number>>(new Set());
  const [colorsError, setColorsError] = useState(false);
  const narrow = useNarrow();
  const { aria } = useModifierKeyLabel();
  const errorId = useId();
  const switchRef = useRef<HTMLElement>(null);
  const codePanelRef = useRef<HTMLDivElement>(null);
  const codeHandleRef = useRef<HTMLDivElement>(null);
  const passes = primaryContrast(theme).aa;
  // A passing colour clears a refused Next (adjusting state during render, not in an effect).
  if (colorsError && passes) setColorsError(false);
  // A failing colour also un-completes Colors (e.g. after going Back), so the later steps are
  // unreachable again until it passes; the set keeps the entry, so they return when it does.
  const showError = !passes && (colorsError || completed.has(0));
  const last = steps.length - 1;

  const update: Update = (patch) => {
    // Functional, so several changes in one batch (a picker drag) all land.
    setTheme((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  };

  const save = () => {
    onSave?.(theme);
    setSaved(true);
  };

  const toggleCode = () => {
    // Hiding the panel that holds focus would drop it to <body>: hand it to the Switch.
    const active = document.activeElement;
    if (
      showCode &&
      (codePanelRef.current?.contains(active) || codeHandleRef.current?.contains(active))
    )
      switchRef.current?.focus();
    setShowCode(!showCode);
  };

  // The listener is added once and always calls the latest `save` / `toggleCode`.
  const commands = useRef({ save, toggleCode });
  useLayoutEffect(() => {
    commands.current = { save, toggleCode };
  });

  // App commands: they work everywhere, typing included, so there is no `isEditable` check.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.isComposing || event.keyCode === 229) return;
      if (matchesShortcut(event, saveKeys)) {
        event.preventDefault();
        commands.current.save();
      } else if (matchesShortcut(event, toggleCodeKeys)) {
        event.preventDefault();
        commands.current.toggleCode();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const next = () => {
    if (current === 0 && !passes) {
      setColorsError(true);
      setCompleted((done) => new Set([...done].filter((index) => index !== 0)));
      return;
    }
    setCompleted((done) => new Set(done).add(current));
    if (current < last) setCurrent(current + 1);
    else save();
  };

  const stepProps = { theme, update };
  return (
    <div className="flex w-full flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Theme Studio</h1>
          <p className="text-sm text-muted-foreground">
            The preview shows the theme on its own surface, whatever the page's light or dark mode.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {/* Always rendered, so the change is announced; empty until a save. */}
          <p role="status" className="text-sm text-muted-foreground">
            {saved ? "Theme saved" : ""}
          </p>
          <Label className="flex items-center gap-2 text-sm">
            <Switch
              ref={switchRef}
              checked={showCode}
              onCheckedChange={setShowCode}
              aria-keyshortcuts={aria(TOGGLE_CODE)}
            />
            Show code
            <KbdShortcut aria-hidden shortcut={TOGGLE_CODE} />
          </Label>
          <Button onClick={save} aria-keyshortcuts={aria(SAVE)}>
            Save
            <KbdShortcut aria-hidden shortcut={SAVE} />
          </Button>
        </div>
      </header>
      <div
        className={`rounded-lg border border-border bg-background text-foreground ${narrow ? "h-[56rem]" : "h-[44rem]"}`}
      >
        {/* Stacked, the controls start taller; the key re-reads the default sizes on a switch. */}
        <ResizablePanelGroup
          key={narrow ? "stacked" : "side"}
          orientation={narrow ? "vertical" : "horizontal"}
        >
          <ResizablePanel defaultSize={narrow ? 55 : 30} minSize={22} collapsible>
            <div data-slot="theme-studio-controls" className="flex h-full flex-col overflow-auto">
              <div className="flex flex-1 flex-col gap-5 p-4">
                <Stepper
                  aria-label="Create theme"
                  orientation="vertical"
                  value={current}
                  onValueChange={setCurrent}
                >
                  {steps.map((title, index) => (
                    <StepperItem
                      key={title}
                      step={index}
                      // While the colours fail, nothing shows as done: the theme needs fixing.
                      completed={completed.has(index) && passes}
                      error={index === 0 && showError}
                    >
                      <StepperTrigger>
                        <StepperIndicator />
                        <StepperTitle>{title}</StepperTitle>
                      </StepperTrigger>
                      {index < last && <StepperSeparator />}
                    </StepperItem>
                  ))}
                </Stepper>
                {current === 0 && (
                  <ColorsStep {...stepProps} showError={showError} errorId={errorId} />
                )}
                {current === 1 && <ShapeStep {...stepProps} />}
                {current === 2 && <ReviewStep {...stepProps} />}
              </div>
              {/* Sticky, so Next stays in view however far the step scrolls. */}
              <div className="sticky bottom-0 flex gap-2 border-t border-border bg-background p-4">
                <Button
                  variant="outline"
                  color="neutral"
                  disabled={current === 0}
                  onClick={() => setCurrent(current - 1)}
                >
                  Back
                </Button>
                <Button onClick={next} aria-describedby={showError ? errorId : undefined}>
                  {current === last ? "Finish" : "Next"}
                </Button>
              </div>
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle aria-label="Resize controls" />
          <ResizablePanel
            minSize={30}
            // The white (or any) surface would paint square corners over the rounded frame: the
            // panel clips its end corners to the frame's inner radius while it is the last panel.
            // (The frame is not `overflow-hidden`, which would clip a collapsed handle's grip.)
            className={
              showCode
                ? undefined
                : narrow
                  ? "rounded-b-[calc(var(--radius-lg)-1px)]"
                  : "rounded-e-[calc(var(--radius-lg)-1px)]"
            }
          >
            <Preview theme={theme} />
          </ResizablePanel>
          {showCode && (
            <>
              <ResizableHandle ref={codeHandleRef} withHandle aria-label="Resize code" />
              <ResizablePanel ref={codePanelRef} defaultSize={25} minSize={15}>
                <CodePanel theme={theme} />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
