import assert from "node:assert/strict";
import { test } from "node:test";

import {
  basePackages,
  isListable,
  listableCounts,
} from "../src/app/lp/catalog/catalog.ts";
import { catalog } from "../src/app/lp/catalog/catalog.ts";
import { cardStats, detailRows, shekels, speedLabel } from "../src/app/lp/catalog/format.ts";

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

test("תצוגה: יחיד ורבים — אין אריח שאומר \"1 ממירים\"", () => {
  // ⚠️ בדיוק השגיאה שההערה על `lineTiers` מזהירה מפניה, רק שהיא
  // הייתה חיה: id 70 הוא ממיר אחד והכרטיס הכריז "1 ממירים".
  for (const p of PACKAGES.filter((x) => x.category === "home" && isListable(x))) {
    const tile = cardStats(p).find((s) => s.caption.startsWith("ממיר"));
    if (!tile) continue;
    const singular = p.spec.converters === 1;
    assert.equal(
      tile.caption,
      singular ? "ממיר כלול" : "ממירים כלולים",
      `${p.id}: ${tile.value} ${tile.caption}`,
    );
  }
});

test("תצוגה: שתי המהירויות נשארות שלמות ביחידה שנבחרה", () => {
  // ⚠️ `{1000, 100}` — 15 מתוך 33 חבילות הבית — הוצג כ-"1/0.1Gb".
  assert.equal(speedLabel({ downloadMbps: 1000, uploadMbps: 100 }), "1,000/100Mb");
  assert.equal(speedLabel({ downloadMbps: 1000, uploadMbps: 1000 }), "1/1Gb");
  assert.equal(speedLabel({ downloadMbps: 500, uploadMbps: 50 }), "500/50Mb");
  assert.equal(speedLabel({ downloadMbps: 2000, uploadMbps: null }), "2Gb");
  for (const p of PACKAGES.filter((x) => x.category === "home" && isListable(x))) {
    const label = speedLabel(p.spec);
    if (label == null) continue;
    assert.ok(!/(^|[^\d])0\./.test(label), `${p.id}: מהירות שברית ב-${label}`);
  }
});

test("תצוגה: שום כרטיס לא מדפיס אותה עובדה פעמיים", () => {
  // ⚠️ 43 מתוך 106 הכרטיסים חזרו ואמרו ב"פרטים מלאים" את מה
  // שהאריח שמעליהם כבר אמר, באותו ניסוח בדיוק.
  // `מהירות (הורדה/העלאה)` נשארה במודע: רק התווית הזו אומרת מי מהם ההורדה.
  const offenders = [];
  for (const p of PACKAGES.filter(isListable)) {
    const tiles = cardStats(p);
    for (const r of detailRows(p)) {
      if (r.label === "מהירות (הורדה/העלאה)") continue;
      if (tiles.some((t) => t.value === r.value && (t.caption === r.label || r.label.includes(t.caption)))) {
        offenders.push(`${p.id}: ${r.label}=${r.value}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `עובדה שהודפסה פעמיים: ${offenders.join(", ")}`);
});

test("תצוגה: עמלה שאינה מספר מדרדרת לקו מפריד ולא מפילה את הדף", () => {
  // ⚠️ `isListable` שומר על `price` ו-`discountPercent` בלבד. כל העמלות
  // מגיעות ל-`shekels` בלי שער, ומחרוזת הפילה שם את רינדור השרת השלם.
  assert.equal(shekels("49.9"), "—");
  assert.equal(shekels(NaN), "—");
  assert.equal(shekels(undefined), "—");
  assert.equal(shekels(49.9), "₪49.9");
  assert.equal(shekels(0), "₪0");
});
