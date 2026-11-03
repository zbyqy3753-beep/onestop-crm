import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages } from "../src/app/lp/catalog/catalog.ts";
import {
  addonFreeThenPaid,
  afterPriceDependsOnLines,
  computeSaving,
  declaresRiseInText,
  isComparable,
  requiresMultipleLines,
  tierCapsAt,
  perLinePrice,
} from "../src/app/lp/catalog/savings.ts";

/*
 * ⚠️ סבב 51, המנוע — ארבעה שערים שהכירו הצהרה בצורה אחת ופספסו את
 * הצורה השכנה שחיה בקטלוג. בכל ארבעתם הרשומות הקיימות נשמרות בחוץ
 * כבר היום דרך שערים אחרים, ולכן **הבריכה והבחירות אינן זזות**
 * (11 סלולר / 2 בית, id 121 בקו בודד ו-117 ב-2–10, id 157 בבית) —
 * מה שנסגר הוא הרשומה הבאה שתנסח כך.
 */

const PKGS = basePackages();
const byId = (id) => structuredClone(PKGS.find((p) => p.id === id));

/** הבריכה והבחירה, כפי שהמחשבון קורא אותן. */
const pool = (pkgs, track) => pkgs.filter((p) => isComparable(p, track)).map((p) => p.id);

test("הבריכה והבחירות של היום — התייחסות לכל התיקונים בסבב", () => {
  assert.deepEqual(pool(PKGS, "cellular").sort(), [
    "116",
    "117",
    "121",
    "25",
    "30",
    "35",
    "65",
    "66",
    "90",
    "91",
    "93",
  ]);
  assert.deepEqual(pool(PKGS, "home").sort(), ["157", "3"]);
  assert.equal(computeSaving(PKGS, "cellular", 1, 300).pick.id, "121");
  assert.equal(computeSaving(PKGS, "cellular", 3, 300).pick.id, "117");
  assert.equal(computeSaving(PKGS, "home", 1, 300).pick.id, "157");
});

/* ── 1. `ואז` — תוספת חינם שמתחילה להיחייב ───────────────────────── */

test("`ואז` הוא `לאחר מכן`: תוספת חינם שמתחילה להיחייב נתפסת בשני הנוסחים", () => {
  /*
   * id 123 כותבת "מגדיל טווח לנחושת – 4 חודשים חינם, לאחר מכן תוספת
   * של 15 ₪", ו-`ואז` חי בקטלוג ב-ids 115, 112 ו-98. `ADDON_FREE_THEN_PAID`
   * מנתה `אח״כ|לאחר מכן|אחר כך` ולא `ואז`, ו-`RISE_IN_TEXT` הכירה
   * `ואז` רק כשספרה נצמדת אליה — ולכן `ואז תוספת של 15 ₪` חמק
   * משניהם יחד.
   */
  const p = byId("123");
  assert.equal(addonFreeThenPaid(p), true, "הנוסח המקורי");

  const neighbour = byId("123");
  neighbour.description = String(neighbour.description).replace(/לאחר מכן/g, "ואז");
  assert.match(String(neighbour.description), /ואז תוספת/);
  assert.equal(addonFreeThenPaid(neighbour), true, "הנוסח השכן חמק מהשער");
  assert.equal(declaresRiseInText(neighbour), true, "וגם משער העלייה");
});

test("ההרחבה אינה מוסיפה אף רשומה לפסילה בקטלוג של היום", () => {
  // ⚠️ `ואז` מתאים ל-ids 123, 83 ב-`ADDON` ול-82, 115, 98 בעלייה —
  // כולן נתפסות כבר דרך `לאחר מכן`, ולכן אפס תוצאות חיוביות חדשות.
  assert.deepEqual(pool(PKGS, "home").sort(), ["157", "3"]);
});

/* ── 2. `להצטרפות` ו-`בצירוף של` — הנוסח של id 16 ────────────────── */

test("`להצטרפות`/`בצירוף של` הם `בהצטרפות`/`בצירוף`: מחיר שמותנה בכמות קווים", () => {
  /*
   * id 16 כותבת "95 ₪ לחודש להצטרפות משפחתית לשלושה קווים" ו-"מותנה
   * בצירוף של שלושה קווים לחשבון אחד" — **שני** הנוסחים שהרשימה לא
   * מנתה (למ"ד במקום בי"ת, ומילה אחת באמצע). היא נשמרה בחוץ רק
   * בזכות ה-`name` שלה ("3 קווים ב 92.70").
   */
  const p = byId("121");
  p.priceAfterPromo = 59;
  p.description = "95 ₪ לחודש בהצטרפות 3 קווים";
  assert.equal(afterPriceDependsOnLines(p), true, "הנוסח שהיה מוכר");

  for (const prose of ["95 ₪ לחודש להצטרפות 3 קווים", "מותנה בצירוף של 3 קווים לחשבון אחד"]) {
    const n = byId("121");
    n.priceAfterPromo = 59;
    n.description = prose;
    assert.equal(afterPriceDependsOnLines(n), true, prose);
  }
});

test("`למצרפים`/`למצטרפים` לא נשמטו מהרשימה בדרך", () => {
  // ⚠️ השער הזה החזיק ארבעה טוקנים, והחלפת שניים מהם בצורה `[בל]`
  // דרסה את השניים האחרים. בלעדיהם הבריכה גדלה מ-11 ל-19.
  const p = byId("121");
  p.priceAfterPromo = 59;
  p.description = "למצרפים 4 מנויים 22 ₪";
  assert.equal(afterPriceDependsOnLines(p), true);
  const q = byId("121");
  q.priceAfterPromo = 59;
  q.description = "למצטרפים 4 מנויים 22 ₪";
  assert.equal(afterPriceDependsOnLines(q), true);
});

/* ── 3. כמות שנכתבה במילים ───────────────────────────────────────── */

test("כמות במילה היא כמות: מחירון שנכתב `שני קווים` אינו מחיר קו בודד", () => {
  /*
   * אותה טבלת מחירים של id 68 ("* קו בודד – 49.90 ₪ * 2 קווים –
   * 24.90 ₪ לקו") במילים נכנסה לבריכה ופרסמה את מחיר שני הקווים
   * כמחיר קו בודד — ₪900 בשנה במקום ₪792 למי שביקש קו אחד.
   */
  // ⚠️ המחיר שבמפרט הוא המדרגה — זה מה ש-`headlineIsLineTierPrice` בודק.
  const digits = byId("121");
  digits.price = 24.9;
  digits.description = "* קו בודד – 49.90 ₪ * 2 קווים – 24.90 ₪ לקו";
  assert.equal(requiresMultipleLines(digits), true, "הנוסח בספרות");

  const words = byId("121");
  words.price = 24.9;
  words.description = "* קו בודד – 49.90 ₪ * שני קווים – 24.90 ₪ לקו";
  assert.equal(requiresMultipleLines(words), true, "הנוסח במילים");
});

test("והמילה דורשת את היחידה אחריה", () => {
  // ⚠️ בלי דרישת היחידה הצורה נדלקת על "שנה שניה" / "חודש שני" —
  // 24 רשומות בקטלוג. מול היחידה: ids 1, 2 ו-16 בלבד.
  const p = byId("121");
  p.description = "המחיר תקף לשנה שניה ולשנה שלישית";
  assert.equal(requiresMultipleLines(p), false);
});

test("ids 1, 2 ו-16 — הנוסח במילים חי בקטלוג, והן מחוץ לבריכה", () => {
  for (const id of ["1", "2", "16"]) {
    assert.equal(isComparable(byId(id), "cellular"), false, id);
  }
});

/* ── 4. `tierCapsAt` — תקרה שנכתבה במילים ────────────────────────── */

test("תקרה במילה היא תקרה: המדרגה אינה מוחלת על כמות שלא תומחרה", () => {
  /*
   * id 37 (`lineTiers: [{lines: 2, price: 24.9}]`) עם המשפט של id 36
   * ("עד 2 מנויים כולל - 24.9 ₪ למנוי") עוצרת את המדרגה בשניים.
   * באותו משפט במילים השער שתק, והמדרגה הוחלה על חמישה קווים —
   * ₪10,500 בשנה במקום ₪10,200 על חשבון ₪1,000.
   */
  const digits = byId("37");
  digits.description = "עד 2 מנויים כולל - 24.9 ₪ למנוי";
  assert.equal(tierCapsAt(digits, 2), true, "הנוסח בספרות");

  const words = byId("37");
  words.description = "עד שני מנויים כולל - 24.9 ₪ למנוי";
  assert.equal(tierCapsAt(words, 2), true, "הנוסח במילים");
  assert.equal(perLinePrice(words, 5), perLinePrice(digits, 5));
});

test("ו-`לשני מנויים ומעלה` אינו תקרה — אותו סדר ענפים שבספרות", () => {
  const p = byId("37");
  p.description = "בתום התקופה: 55 ₪ למנוי אחד, לשני מנויים ומעלה- 50 ₪ לכל מנוי";
  assert.equal(tierCapsAt(p, 2), false);
});

test("המדרגות שבקטלוג אינן זזות", () => {
  // ⚠️ ארבע הרשומות שנושאות `lineTiers` כותבות ספרות; התיקון מוסיף
  // צורה ואינו מחליף אותה.
  for (const id of ["36", "37", "57", "68"]) {
    const p = byId(id);
    assert.equal(typeof perLinePrice(p, 1), "number", id);
  }
  assert.equal(computeSaving(PKGS, "cellular", 5, 1000).pick.id, "117");
  assert.equal(computeSaving(PKGS, "cellular", 5, 1000).yearly, 10200);
});
