/**
 * The button class strings.
 *
 * Constants and not a component, for the same reason as `field.ts`: these are
 * worn by `<button>`, `<a>` and `<Link>` in roughly equal measure, and a
 * polymorphic `as` prop is real TypeScript cost in a repo that has no such
 * helper anywhere else.
 *
 * Every variant carries `transition` — one of the copies these replace had a
 * `hover:` colour with no transition, so it snapped while its neighbours faded.
 */

/** The commit action: submit, "call me back", "see the package". */
export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-lp-brand px-4 py-2.5 text-sm font-semibold text-lp-ink-invert transition hover:bg-lp-brand-bright disabled:cursor-not-allowed disabled:opacity-40";

/** The alternative next to a primary — never two primaries side by side. */
export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-lp-line bg-lp-surface px-4 py-2.5 text-sm font-medium text-lp-ink-2 transition hover:border-lp-brand hover:text-lp-brand";

/**
 * Cyan on navy — the header CTA. Reads as the brightest thing in the bar, which
 * is the point: it is the only control up there that starts a conversation.
 */
export const btnAccent =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-lp-brand-bright px-4 py-2 text-sm font-semibold text-lp-navy transition hover:bg-lp-brand-glow";

/** Quiet buttons sitting on a navy surface — hero category links, hero chips. */
export const btnOnNavy =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-lp-navy-2 px-4 py-2.5 text-sm font-medium text-lp-on-navy transition hover:bg-lp-navy-3";
