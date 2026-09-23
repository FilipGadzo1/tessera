/** Color roles every toned component accepts through its `color` prop. */
export const toneColors = ["primary", "neutral", "success", "warning", "danger", "info"] as const;

export type ToneColor = (typeof toneColors)[number];

/** `tone-*` utility per color — literal strings so Tailwind's scanner finds them in dist/. */
export const toneClass: Record<ToneColor, string> = {
  primary: "tone-primary",
  neutral: "tone-neutral",
  success: "tone-success",
  warning: "tone-warning",
  danger: "tone-danger",
  info: "tone-info",
};
