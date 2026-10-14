import { basePackages, displayName, listable, providerName } from "@/app/lp/catalog/catalog";
import {
  dataLabel,
  installationIsConditional,
  specOf,
  speedLabel,
} from "@/app/lp/catalog/format";
import type { CellularSpec, ElectricitySpec, HomeSpec, Package } from "@/app/lp/catalog/types";

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
  /**
   * עלות התקנה — רק כשהיא מספר **אחד**. ראה `installation` ב-`studioPackages`.
   */
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

/*
 * ⚠️ הכול דרך `specOf`, ולא `p.spec` ישירות.
 *
 * `spec: null` זרק כאן `Cannot read properties of null` על `hoursText` —
 * כלומר רשומת חשמל אחת פגומה הפילה את רינדור **כל** הסטודיו, בדיוק
 * הנפילה ש-`specOf` נבנה נגדה ב-`format.ts` ולא הוחל על המשטח הזה.
 *
 * ⚠️ ו-`typeof === "string"` על `hoursText`, כמו באריח וכמו בשורת
 * הפירוט: זה השדה היחיד שמודפס **כמות שהוא**, בלי `nf.format` ובלי
 * `shekels` שידרדרו ערך פגום, ולכן ערך שאינו מחרוזת היה מתפרסם בפוסט
 * כ-"[object Object]" בשם של אלירן. כל 9 הרשומות שהשדה שלהן ריק נושאות
 * `null` היום; הקטלוג נכנס דרך `as unknown as Catalog` ואין ולידציה
 * בזמן ריצה, ולכן זה שער לרענון הבא.
 */
function stat(p: Package): string | null {
  if (p.category === "electricity") {
    const spec = specOf<ElectricitySpec>(p);
    if (typeof spec.hoursText === "string" && spec.hoursText) return spec.hoursText;
    return spec.allHours ? "כל שעות היממה" : null;
  }
  if (p.category === "cellular") return dataLabel(p, specOf<CellularSpec>(p));
  return speedLabel(p, specOf<HomeSpec>(p));
}

/*
 * ⚠️ עלות התקנה מתפרסמת רק כשהיא מספר אחד.
 *
 * `installationCost` הוא שדה אחד והפרוזה מוכרת שני מחירים: 15 מ-18
 * חבילות הבית שהשדה שלהן 0 אומרות "בבניין 0 / בית פרטי 125" או
 * "...499" (ids 3, 73, 92, 102, 104, 107, 108, 109, 113, 115, 153, 154,
 * 157, 158, 159), והפוסט הדפיס "התקנה: ללא עלות" מול תשלום חד-פעמי של
 * מאות שקלים. הכרטיס ב-`/lp` כבר סוגר את זה (`installationIsConditional`,
 * קומיט b3d6b2a) ונשען על שורת הפירוט שאומרת את **שני** הצדדים — שורה
 * שאין לה מקבילה בשקף. `installation: number | null` אינו יכול להחזיק
 * שני מחירים, ולכן העובדה נשמטת ולא נאמרת חצי: "לא יודעים — לא
 * מבטיחים", והנחה של מאות שקלים היא בדיוק הפער שאסור להמציא בפוסט.
 */
function installation(p: Package): number | null {
  if (p.category !== "home" || installationIsConditional(p)) return null;
  const cost = specOf<HomeSpec>(p).installationCost;
  return typeof cost === "number" && Number.isFinite(cost) ? cost : null;
}

/*
 * ⚠️ רשומה אחת, מיוצאת בנפרד מהרשימה. השערים כאן נכתבו נגד **רענון**
 * קטלוג ולא נגד הנתונים של היום (`spec: null`, `hoursText` שאינו
 * מחרוזת), והקטלוג החי נקי מהם — כלומר בדיקה שרצה על
 * `studioPackages()` לבדה הייתה עוברת בלי לבדוק כלום. אותו טעם של
 * הרשומות המסונתזות ב-`lpPlural.test.mjs`.
 */
export function studioPackage(p: Package): StudioPackage {
  return {
    id: p.id,
    category: p.category,
    provider: providerName(p),
    name: displayName(p.name),
    price: p.category === "electricity" ? null : p.price,
    after: trustedAfter(p),
    discountPercent: p.category === "electricity" ? p.discountPercent : null,
    stat: stat(p),
    installation: installation(p),
  };
}

export function studioPackages(): StudioPackage[] {
  return listable(basePackages()).map(studioPackage);
}
