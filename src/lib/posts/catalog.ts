import { basePackages, displayName, listable } from "@/app/lp/catalog/catalog";
import { dataLabel, speedLabel } from "@/app/lp/catalog/format";
import type { CellularSpec, HomeSpec, Package } from "@/app/lp/catalog/types";

/**
 * החבילות שסטודיו הפוסטים מציע, בצורה רזה שעוברת ללקוח.
 *
 * ⚠️ הכול נגזר מהקטלוג של `/lp` ולא מהקטלוג של ה-CRM: הפוסטים מפנים
 * לאתר, ומספר בפוסט שאינו המספר שהגולש רואה באתר הוא בדיוק הסתירה
 * שהפוסטים האלה טוענים שהם חושפים.
 */
export interface StudioPackage {
  id: string;
  category: Package["category"];
  provider: string;
  name: string;
  /** מחיר חודשי. `null` בחשמל, שם יש אחוז הנחה במקום. */
  price: number | null;
  /** המחיר אחרי תום ההטבה — רק כשהוא ידוע ותואם לתיאור (ראה `trustedAfter`). */
  after: number | null;
  discountPercent: number | null;
  /** שורת מפרט קצרה: נפח, מהירות או שעות ההנחה. */
  stat: string | null;
  installation: number | null;
}

/*
 * ⚠️ מחיר "אחרי ההטבה" שהתיאור של אותה רשומה מכחיש לא נכנס לפוסט.
 *
 * בקטלוג של 14.8.2026 יש רשומות שהשדה `priceAfterPromo` שלהן סותר את
 * הטקסט שלהן: `Prince` (59.9 בשדה, "49.8" בתיאור) ו-`300GB PERFECT`
 * (69 מול "69.90"). באתר זה פגם מוכר; בפוסט זה מספר שגוי שמתפרסם בשם
 * של אלירן. לכן: אם התיאור מזכיר מחיר אחרי "לאחר"/"אחרי"/"מחודש",
 * השדה חייב להופיע ביניהם. תיאור שלא מזכיר מחיר כזה לא פוסל.
 */
const AFTER_PHRASE = /(?:לאחר|אחרי|מחודש|החל מחודש)[^|\n]{0,40}/g;

function trustedAfter(p: Package): number | null {
  if (p.category === "electricity") return null;
  const after = p.priceAfterPromo;
  if (typeof after !== "number" || !Number.isFinite(after) || p.price == null) return null;
  if (after <= p.price) return null;
  // "4 ב 130", "3 קווים ב 92.70": המחיר הוא לקו בתוך קבוצה או לכל הקבוצה,
  // ובשקף "מחיר לקו" שני המקרים מטעים.
  if (/קווים|^\d+\s*ב\s*\d/.test(p.name)) return null;
  const phrases = (p.description ?? "").match(AFTER_PHRASE) ?? [];
  const mentioned = phrases.flatMap((s) => (s.match(/\d+(?:\.\d+)?/g) ?? []).map(Number));
  const prices = mentioned.filter((n) => n >= 10);
  if (prices.length > 0 && !prices.some((n) => Math.abs(n - after) < 0.05)) return null;
  return after;
}

function stat(p: Package): string | null {
  if (p.category === "electricity") return p.spec.hoursText ?? (p.spec.allHours ? "כל שעות היממה" : null);
  if (p.category === "cellular") return dataLabel(p.spec as CellularSpec);
  return speedLabel(p.spec as HomeSpec);
}

export function studioPackages(): StudioPackage[] {
  return listable(basePackages()).map((p) => ({
    id: p.id,
    category: p.category,
    provider: p.provider.name,
    name: displayName(p.name),
    price: p.category === "electricity" ? null : p.price,
    after: trustedAfter(p),
    discountPercent: p.category === "electricity" ? p.discountPercent : null,
    stat: stat(p),
    installation: p.category === "home" ? ((p.spec as HomeSpec).installationCost ?? null) : null,
  }));
}
