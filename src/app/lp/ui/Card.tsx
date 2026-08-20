/**
 * The card.
 *
 * ⚠️ There were four different cards on this site: the package card had a
 * shadow and a hover lift, the blog post card had neither, the filter panel and
 * the unavailable-package panel had a border only, and the savings calculator
 * had a shadow but no hover. They all sat on the same background, so a reader
 * moving from `/cellular` to `/blog` saw two different sites. Inconsistency at
 * that level reads as carelessness, which is expensive on a page asking for a
 * phone number.
 *
 * `interactive` is the entire API, and it maps to one question: does clicking
 * this thing go somewhere? If yes it lifts on hover; if no it sits still.
 */
export function Card({
  interactive = false,
  as: Tag = "div",
  className = "",
  children,
}: {
  interactive?: boolean;
  as?: "div" | "article" | "li" | "section";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tag
      className={`rounded-lp-card border border-lp-line bg-lp-surface shadow-lp-card ${
        interactive
          ? "transition hover:border-lp-line-strong hover:shadow-lp-lift"
          : ""
      } ${className}`}
    >
      {children}
    </Tag>
  );
}
