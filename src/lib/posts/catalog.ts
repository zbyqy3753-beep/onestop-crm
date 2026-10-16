import { basePackages, displayName, isMoney, listable, providerName } from "@/app/lp/catalog/catalog";
import {
  dataLabel,
  discountIsCapped,
  discountScope,
  installationIsConditional,
  priceNote,
  promoRise,
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
  /**
   * מה שהרשומה מסרה בפרוזה על התקופה שאחרי ההטבה, כשלא מסרה מספר.
   * ראה `afterNote` למטה.
   */
  afterNote: string | null;
  /** `afterNote` שכל המספרים שבו **גבוהים** מ-`price`. ראה `afterRises`. */
  afterRises: boolean;
  /**
   * הרשומה מצהירה על תקופת מבצע ולא נמסר ממנה לא מספר אמין ולא נוסח.
   * ראה `promoPeriod` למטה.
   */
  promoPeriod: boolean;
  discountPercent: number | null;
  /** אחוז ההנחה הוא **תקרה** ("עד 10%") ולא שיעור אחיד. */
  discountIsCapped: boolean;
  /** מה ההנחה חלה עליו, בנוסח הרשומה ("רכיב התשלום המשתנה"). */
  discountScope: string | null;
  /** ההסתייגות שהרשומה מסרה על המחיר החודשי. ראה `monthlyPriceNote`. */
  priceNote: string | null;
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
 * ⚠️ מה שהרשומה מסרה על "אחרי ההטבה" כשהיא **לא** מסרה מספר.
 *
 * `after: number | null` לא יכול להחזיק נוסח מילולי, ולכן התבנית נפלה
 * לברירת המחדל "כדאי לבדוק מה קורה למחיר כשההטבה נגמרת" — כלומר
 * **הכחשה** של ההצהרה שהרשומה כן מסרה, על 11 רשומות שיש להן
 * `priceAfterPromoNote` (ids 23, 42, 58, 61, 81, 83, 85, 92, 108, 109,
 * 132) ועל 19 נוספות שנתפסות ב-`declaresRiseInText` בלבד. זה בדיוק מה
 * שענף ה-`note` וענף ה-`period` של `promoRise` כבר אומרים בכרטיס
 * ובפס ההירו, ושלא חובר למשטח הרביעי.
 *
 * ⚠️ `promoPeriod` נדלק גם כשענף ה-`amount` של `promoRise` דלוק אבל
 * `trustedAfter` פסל את המספר (ids 11, 70, 90, 123 — שם התיאור סותר
 * את השדה, או שהשם מוכר קבוצת קווים): יש תקופת מבצע, המספר אינו אמין,
 * ולכן נאמר מה שידוע ולא מה שלא.
 */
function afterNote(p: Package): string | null {
  const rise = promoRise(p);
  return rise?.kind === "note" ? rise.note : null;
}

/*
 * ⚠️ שער כיוון, במשקל של `trustedAfter`: "המחיר **עולה**" ייאמר רק
 * כשכל המספרים שבנוסח גבוהים מ-`price`.
 *
 * הנוסח אינו מסודר, ובשלוש מתוך 11 הרשומות המחיר שבו **נמוך**
 * מ-`price`: ids 92, 108, 109 אומרות "לאחר שנה 159 ₪ לחודש + 34.9 ₪
 * נתב" כש-`price` 173.9/168.9/109. ובשש נוספות (23, 58, 81, 85, 132)
 * הנוסח מצטט גם את מחיר המבצע **הזול** וגם את מחיר הקבע, ו-`price`
 * הוא כבר מחיר הקבע — אותו מצב שמתועד בענף ה-`period` של
 * `promoRise` על ids 45, 67, 71, 72, 73, 98, 124, 125, 153, 159. ניסוח
 * כיווני בלי השער הזה היה שם מספר שגוי בכיוון ההפוך.
 *
 * רק ids 42, 61, 83 עוברות ("אחרי שנתיים 69.9" מול 39.9), ועליהן בלבד
 * מותר לומר שהמחיר עולה. על כל השאר מודפס **נוסח הרשומה כמות שהוא**.
 */
function afterRises(p: Package, note: string | null): boolean {
  /*
   * ⚠️ `isMoney` ולא `Number.isFinite`: `price: 0` הוא הצורה שהמחלץ
   * מייצר כשלא קרא מחיר (ids 18, 22), וכל מספר בנוסח גבוה ממנו —
   * כלומר השער היה נפתח דווקא על הרשומה שאין לנו עליה מחיר להשוות
   * אליו. `isListable` חוסם 0 מהרשימה, אבל `studioPackage` מיוצאת
   * לבדה, ושער שתלוי בשער אחר הוא הדפוס שהקובץ הזה נכתב נגדו.
   */
  if (note == null || !isMoney(p.price)) return false;
  const nums = (note.match(/\d+(?:\.\d+)?/g) ?? []).map(Number).filter((n) => n >= 10);
  return nums.length > 0 && nums.every((n) => n > (p.price as number));
}

/*
 * ⚠️ ההסתייגות על המחיר החודשי, מאותו מקור שהכרטיס וטבלת ההשוואה
 * קוראים ממנו (`priceNote` ב-`format.ts`).
 *
 * חשמל מוחזר `null` כאן בכוונה: שם `priceNote` מחזירה את ניסוח
 * ה-`discountScope`, והוא נאמר בכותרת הפוסט דרך `discountScope`
 * עצמו, ושתי אמירות על אותו מספר זו מעל זו הן הפגם שההערה על
 * `proseFloorsAt` מתארת.
 *
 * הפער שנסגר כאן: id 85 (`Partner Fiber`) אומרת פעמיים "לאחר מכן
 * **מ-100 ₪ לחודש**" ו-`price` שלה 100, והפוסט הדפיס "₪100 לחודש"
 * כמחיר אחיד — בדיוק מה שהכרטיס הפסיק להדפיס. וכן 8 רשומות סלולר
 * שהמחיר שלהן מותנה בכמות מנויים (ids 16, 27, 28, 29, 42, 51, 68,
 * 110) ושתיים שהמחיר שלהן הוא מחיר במסלול משפחתי (36, 117).
 */
function monthlyPriceNote(p: Package): string | null {
  if (p.category === "electricity") return null;
  return priceNote(p)?.value ?? null;
}

/*
 * ⚠️ רשומה אחת, מיוצאת בנפרד מהרשימה. השערים כאן נכתבו נגד **רענון**
 * קטלוג ולא נגד הנתונים של היום (`spec: null`, `hoursText` שאינו
 * מחרוזת), והקטלוג החי נקי מהם — כלומר בדיקה שרצה על
 * `studioPackages()` לבדה הייתה עוברת בלי לבדוק כלום. אותו טעם של
 * הרשומות המסונתזות ב-`lpPlural.test.mjs`.
 */
export function studioPackage(p: Package): StudioPackage {
  const after = trustedAfter(p);
  const note = afterNote(p);
  return {
    id: p.id,
    category: p.category,
    provider: providerName(p),
    name: displayName(p.name),
    price: p.category === "electricity" ? null : p.price,
    after,
    afterNote: note,
    afterRises: afterRises(p, note),
    promoPeriod: promoRise(p) != null && after == null && note == null,
    discountPercent: p.category === "electricity" ? p.discountPercent : null,
    discountIsCapped: discountIsCapped(p),
    discountScope: discountScope(p),
    priceNote: monthlyPriceNote(p),
    stat: stat(p),
    installation: installation(p),
  };
}

export function studioPackages(): StudioPackage[] {
  return listable(basePackages()).map(studioPackage);
}
