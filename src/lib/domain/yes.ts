/**
 * ── זיהוי לידים של יאס ────────────────────────────────────────────────
 *
 * מודול טהור, בלי שום ייבוא — אותו שיקול כמו ב-`alerts.ts`: הכלל הזה
 * מחליט למי הליד הולך ומי מקבל התראה, וזה בדיוק סוג הכלל שצריך
 * שאפשר יהיה לבדוק בלי להרים שרת ובלי DB.
 *
 * ⚠️ **הזיהוי הוא לפי תוכן הליד ולא לפי מי שלח אותו.** ליד של יאס
 * יכול להגיע מכל שותף ומכל דף נחיתה, ולכן החיפוש הוא בספק שזוהה,
 * בשם החבילה ובשדה המקור.
 */

/**
 * ⚠️ גבולות מילה, ולא `includes`.
 *
 * `"יס"` כרצף תווים מופיע בתוך מילים עבריות רגילות לגמרי — "ניסיון",
 * "פיס", "כניסה" — וחיפוש תת-מחרוזת היה מסמן לידים אקראיים כלידים של
 * יאס ומעביר אותם לטלי. ב-JS `\b` נשען על `\w` שהוא ASCII בלבד
 * ולכן חסר תועלת לעברית, ומכאן ה-lookaround המפורש על טווח האותיות.
 *
 * `yes` הלטיני מקבל `\b` רגיל, וכך `"FIBER YES+ 1000MB"` נתפס בעוד
 * `"yesterday"` לא.
 */
const YES_PATTERNS: readonly RegExp[] = [
  /\byes\b/i,
  /(?<![א-ת])יאס(?![א-ת])/,
  /(?<![א-ת])יס(?![א-ת])/,
];

/** האם המחרוזת מזכירה את יאס כמילה עומדת בפני עצמה. */
export function mentionsYes(value: string | null | undefined): boolean {
  const text = (value ?? "").trim();
  return text !== "" && YES_PATTERNS.some((re) => re.test(text));
}

/**
 * מה שצריך לדעת על ליד כדי להחליט אם הוא של יאס. מבנה מינימלי
 * בכוונה — הוא נקרא גם לפני שהליד נוצר, כשאין עדיין רשומה.
 */
export interface YesLeadFacts {
  /** הספק שזוהה, אם זוהה. `"yes"` הוא סימן ודאי. */
  currentProvider?: string | null;
  packageName?: string | null;
  sourceDetail?: string | null;
}

/**
 * האם זה ליד של יאס.
 *
 * ⚠️ הספק שזוהה קודם לטקסט: `currentProvider` הוא תוצאה של פענוח
 * (`matchProvider`) ולא ניחוש, ולכן הוא הסימן החזק. שני השדות
 * האחרים הם מה שנשלח בפועל מהשותפים — שם החבילה ושדה המקור החופשי.
 */
export function isYesLead(facts: YesLeadFacts): boolean {
  if (facts.currentProvider === "yes") return true;
  return mentionsYes(facts.packageName) || mentionsYes(facts.sourceDetail);
}
