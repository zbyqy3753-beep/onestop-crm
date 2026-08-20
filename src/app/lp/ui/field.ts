/**
 * The form-control class strings.
 *
 * Exported as constants rather than a `<Field>` component on purpose: the seven
 * places that needed them wrap `<input>`, `<select>` and `<textarea>`, some with
 * `rows`, some with `dir="ltr"`, some with help text. A component would have had
 * to absorb all of that and would have fought every call site. A string cannot
 * drift, and swapping it in is a one-line change each.
 *
 * ⚠️ No `outline-none` here, and do not add it back. Focus is owned by the
 * global `:focus-visible` rule in globals.css — the old
 * `outline-none focus:border-lp-brand` pairing removed the focus indicator and
 * replaced it with a 1px border colour change, which is not an indicator.
 */
export const fieldClass =
  "w-full rounded-lg border border-lp-line bg-lp-surface px-3 py-2.5 text-sm text-lp-ink transition placeholder:text-lp-ink-3 focus:border-lp-brand";

/** Same control, sized for the dense admin tables. */
export const fieldCompactClass =
  "w-full rounded-lg border border-lp-line bg-lp-surface px-3 py-2 text-sm text-lp-ink transition placeholder:text-lp-ink-3 focus:border-lp-brand";

export const labelClass = "mb-1 block text-xs font-medium text-lp-ink-2";

export const fieldHintClass = "mt-1 text-lp-2xs text-lp-ink-3";

export const fieldErrorClass = "mt-1 text-lp-2xs text-lp-rise";
