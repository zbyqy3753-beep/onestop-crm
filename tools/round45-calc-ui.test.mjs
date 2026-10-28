import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { basePackages, listable } from "../src/app/lp/catalog/catalog.ts";
import { isComparable, phoneLineCostsExtra } from "../src/app/lp/catalog/savings.ts";

/*
 * ⚠️ סבב 45 — ההסתייגות על קו הטלפון הוצגה בתנאי רחב ונשלחה לנציג
 * בתנאי צר.
 *
 * המסך הציג "הנציג יתמחר אותו בנפרד" על `hasPhone !== true` **או**
 * `phoneLineCostsExtra`, וההערה לנציג — שהיא כל מה שהוא רואה —
 * נוספה רק על `phoneLineCostsExtra`. כלומר חבילה ביתית בלי קו טלפון
 * ובלי הצהרת תוספת נתנה לגולש הבטחה שהנציג לא ידע עליה. ההערה על
 * ההערה מצהירה על הכלל: "כל אמירה של המסך שמשנה את המספר חייבת
 * להופיע גם כאן".
 *
 * רדום בקטלוג של היום (id 157 זולה ולכן נבחרת בכל מקרה ביתי) — זו
 * הגנה על הרענון הבא, כמו רוב השערים ב-`savings.ts`.
 */

const live = listable(basePackages());
const pool = live.filter((p) => isComparable(p, "home"));
const byId = (id) => pool.find((p) => String(p.id) === String(id));

/** אותה נגזרת שהרכיב מחשב — שני המשטחים קוראים אותה. */
const disclosure = (p) => ({
  extra: phoneLineCostsExtra(p),
  missing: p.spec?.hasPhone !== true,
});
const shows = (p) => disclosure(p).extra || disclosure(p).missing;

test("סבב 45: שתי הרשומות בבריכה הביתית הן שני המצבים השונים", () => {
  // id 157 — יש קו, בתוספת ₪20. id 3 — אין קו כלל.
  assert.deepEqual(disclosure(byId("157")), { extra: true, missing: false });
  assert.deepEqual(disclosure(byId("3")), { extra: false, missing: true });
});

test("סבב 45: כל רשומה שהמסך מצהיר עליה מקבלת גם נוסח לנציג", () => {
  /*
   * ⚠️ זו ההפרה שתוקנה: id 3 הדליקה את ההצהרה על המסך
   * (`missing: true`) בזמן שתנאי ההערה (`extra`) היה כבוי.
   */
  for (const p of pool) {
    if (!shows(p)) continue;
    const { extra } = disclosure(p);
    const note = extra
      ? "החבילה היא אינטרנט וטלוויזיה — קו טלפון בתוספת לפי הרשומה; לתמחר בנפרד"
      : "החבילה היא אינטרנט וטלוויזיה — אינה כוללת קו טלפון; לתמחר בנפרד";
    assert.ok(note.length > 0, `id ${p.id}`);
  }
  // ושתיהן אכן מצהירות, כלומר אין בבריכה רשומה שאין עליה גילוי.
  assert.deepEqual(pool.filter((p) => shows(p)).map((p) => String(p.id)).sort(), ["157", "3"]);
});

test("סבב 45: שני המשטחים קוראים נגזרת אחת ולא שני תנאים", () => {
  /*
   * ⚠️ מבחן על המקור, כי הרכיב הוא React ואינו נטען כאן. מה שהמבחן
   * מקבע הוא דווקא הדבר שנשבר: ששני המשטחים אינם מחזיקים כל אחד
   * את התנאי שלו. `phoneLineCostsExtra` נקרא פעם אחת בלבד — בתוך
   * הנגזרת — ושני הקוראים מסתמכים על `phoneDisclosure`.
   */
  const src = readFileSync(
    new URL("../src/app/lp/ui/SavingsCalculator.tsx", import.meta.url),
    "utf8",
  );
  assert.equal(src.match(/phoneLineCostsExtra\(/g).length, 1);
  assert.ok(src.includes("const phoneDisclosure ="));
  // שני הקוראים: הפסקה שעל המסך וההערה לנציג.
  assert.ok(src.match(/\bphoneDisclosure\b/g).length >= 3);
});

test("סבב 45: הכותרת והפסקה מוסתרות כשאין מתחתיהן טופס", () => {
  /*
   * ⚠️ מיד אחרי שליחה `LeadForm` מחליף את ה-`<form>` כולו בפאנל
   * האישור ונשאר באותו מאונט — ולכן הכותרת שאלה "לשלוח את הנתונים
   * המעודכנים?" והפסקה הזמינה לשליחה נוספת מעל פאנל שאין בו שדה
   * אחד. `confirming` הוא המצב הרגעי הזה, והוא מתאפס לפי `step`
   * כדי שלא יישכח באחד מארבעת מטפלי הכפתורים.
   */
  const src = readFileSync(
    new URL("../src/app/lp/ui/SavingsCalculator.tsx", import.meta.url),
    "utf8",
  );
  assert.ok(src.includes("const [confirming, setConfirming] = useState(false)"));
  assert.ok(src.includes("{!confirming && ("));
  assert.ok(src.includes("setConfirming(true)"));
  /*
   * האיפוס נעשה בכניסה לשלב 2 — המקום היחיד שצריך אותו, כי
   * `setStep(2)` נקרא מ-`submitSpend` לבדו וכל חזרה לשלב עוברת שם.
   * לא `useEffect` על `step`: קריאת `setState` מתוך אפקט נפסלת
   * ב-`react-hooks/set-state-in-effect`, וכאן אין בה צורך.
   */
  assert.match(src, /setConfirming\(false\);\s*\n\s*setStep\(2\);/);
  assert.doesNotMatch(src, /useEffect\(\(\) => \{\s*\n\s*if \(step !== 2\)/);
});
