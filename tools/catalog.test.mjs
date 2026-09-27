import assert from "node:assert/strict";
import { test } from "node:test";

import {
  basePackages,
  isListable,
  listableCounts,
} from "../src/app/lp/catalog/catalog.ts";
import { catalog } from "../src/app/lp/catalog/catalog.ts";

/*
 * ⚠️ הבדיקות רצות מול **הקטלוג האמיתי** (`packages.json`) ולא מול נתוני
 * בדיקה, ומשמעות כישלון כאן היא "הרענון האחרון של הקטלוג הפיל רשומה" —
 * לא בהכרח "מישהו שבר את הקוד".
 *
 * ⚠️ הקטלוג נכנס לקוד דרך `as unknown as Catalog`, כלומר **אין ולידציה
 * בזמן ריצה**. `isListable` הוא השער היחיד שכל החבילות עוברות בו, והוא
 * מפיל רשומה פגומה בשקט — בכוונה, כדי שלא יוצג `NaN` לגולש. השקט הזה
 * הוא גם הסכנה: עד היום אף נתיב בקוד לא השווה בין מספר החבילות שהקובץ
 * מצהיר עליו (`catalog.counts`) לבין מספר החבילות שהדף באמת מציג, ולכן
 * רענון שמפיל עשרים חבילות היה עובר בלי מילה. הבדיקות כאן הופכות את
 * הנפילה השקטה לכישלון בשם.
 */

const PACKAGES = basePackages();

/*
 * שלוש הרשומות שנופלות היום, כולן פגמי מחלץ ולא באגים בקוד:
 *
 *   18  `*2* 3 קווים ב99`      — `price: 0`, המחיר האמיתי (99) נשאר בשם בלבד
 *   22  `3 קווים ב 92.70 *2*`  — `price: 0`, המחיר האמיתי (92.70) נשאר בשם בלבד
 *   144 `סלקום אנרגי עובדי תע` — `discountPercent: null`, השם נקטע באמצע מילה
 *
 * ⚠️ אל תשלימו את 144 מ-`rawPriceField`. הערך שם הוא 6 ונראה כמו התשובה,
 * אבל באותו שדה יושב 15 בשתי רשומות שההנחה שלהן 8 ו-20 (ids 143, 150) —
 * כלומר השדה אינו אחוז ההנחה, והשלמה ממנו תפרסם אחוז שגוי באתר השוואה.
 *
 * הרשימה הזו היא חוב ידוע ולא היתר כללי: רשומה **חדשה** שתיפול תכשיל.
 *
 * ⚠️ `id` הוא **מחרוזת** בקטלוג ולא מספר. רשימה שנכתבת כמספרים לא
 * תתאים לאף רשומה, וכל השלוש יידווחו כנפילות חדשות.
 */
const KNOWN_UNLISTABLE = new Set(["18", "22", "144"]);

test("קטלוג: אף חבילה חדשה לא נופלת בשקט מהשער", () => {
  const dropped = PACKAGES.filter((p) => !isListable(p)).map((p) => p.id);
  const unexpected = dropped.filter((id) => !KNOWN_UNLISTABLE.has(id));

  assert.deepEqual(
    unexpected,
    [],
    `רשומות שהרענון האחרון הפיל ואינן ברשימת החוב הידוע: ${unexpected.join(", ")}`,
  );
});

test("קטלוג: חבילה שתוקנה יורדת מרשימת החוב", () => {
  const dropped = new Set(PACKAGES.filter((p) => !isListable(p)).map((p) => p.id));
  const fixed = [...KNOWN_UNLISTABLE].filter((id) => !dropped.has(id));

  assert.deepEqual(
    fixed,
    [],
    `רשומות שכבר תקינות ויש למחוק מ-KNOWN_UNLISTABLE: ${fixed.join(", ")}`,
  );
});

test("קטלוג: הפער בין מה שהקובץ מצהיר למה שהדף מציג הוא בדיוק החוב הידוע", () => {
  const shown = listableCounts(PACKAGES);

  assert.equal(
    catalog.counts.total - shown.total,
    KNOWN_UNLISTABLE.size,
    `הקובץ מצהיר ${catalog.counts.total} חבילות והדף מציג ${shown.total}`,
  );
});

/*
 * השער בודק `typeof === "number"` ולא `!= null` בדיוק בגלל התרחיש הזה:
 * `"39.9" > 0` הוא `true`, ולכן מחיר שיישאב פעם אחת כמחרוזת היה עובר
 * שער רופף, מגיע ל-`shekels()` ומוצג לגולש כ-`NaN`. כאן זה נתפס בשם.
 */
test("קטלוג: שדות מספריים לא נשאבו כמחרוזת", () => {
  const offenders = [];
  for (const p of PACKAGES) {
    for (const field of ["price", "priceAfterPromo", "discountPercent"]) {
      const v = p[field];
      if (v != null && typeof v !== "number") {
        offenders.push(`${p.id}.${field}=${JSON.stringify(v)}`);
      }
    }
  }

  assert.deepEqual(offenders, [], `שדות מספריים שהגיעו כמחרוזת: ${offenders.join(", ")}`);
});

test("קטלוג: המזהים ייחודיים", () => {
  const seen = new Set();
  const dupes = [];
  for (const p of PACKAGES) {
    if (seen.has(p.id)) dupes.push(p.id);
    seen.add(p.id);
  }

  assert.deepEqual(dupes, [], `מזהים כפולים: ${dupes.join(", ")}`);
});
