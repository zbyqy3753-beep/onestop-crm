import type { StatusTone } from "./types";

/**
 * משוב בודקים על המערכת עצמה.
 *
 * זו מטא-דאטה על המוצר — לא ישות עסקית. לכן היא יושבת במודול נפרד
 * ולא ב-`types.ts` לצד `Lead`/`Deal`/`Package`. אין לה שום קשר
 * למודל הדומיין ואין לקשר אותה אליו.
 */

export type FeedbackKind = "bug" | "improvement" | "idea";

export interface Feedback {
  id: string;
  kind: FeedbackKind;
  /** נתיב המסך שעליו המשוב, או "general" למשוב כללי */
  screen: string;
  /** 1..5 — כמה זה מפריע (לבאג) או כמה זה חשוב (לשיפור) */
  rating: number;
  body: string;
  /** שם חופשי שהבודק הקליד. לא מקושר ל-`User` בכוונה — */
  /** בודקים הם לא בהכרח משתמשי המערכת. */
  reporter: string;
  /** ISO */
  createdAt: string;
}

export type CreateFeedbackInput = Omit<Feedback, "id" | "createdAt">;

/** מקור האמת היחיד לרינדור סוג משוב — אותה תבנית כמו `STATUS_CONFIG`. */
export const FEEDBACK_KIND_CONFIG: Record<
  FeedbackKind,
  { label: string; tone: StatusTone }
> = {
  bug: { label: "באג", tone: "bad" },
  improvement: { label: "שיפור", tone: "warn" },
  idea: { label: "רעיון", tone: "info" },
};

export const FEEDBACK_KIND_ORDER: FeedbackKind[] = [
  "bug",
  "improvement",
  "idea",
];

export const GENERAL_SCREEN = "general";

export function isFeedbackKind(value: unknown): value is FeedbackKind {
  return (
    typeof value === "string" &&
    FEEDBACK_KIND_ORDER.includes(value as FeedbackKind)
  );
}
