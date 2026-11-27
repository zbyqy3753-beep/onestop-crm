import test from "node:test";
import assert from "node:assert/strict";

import { basePackages } from "../src/app/lp/catalog/catalog.ts";
import { detailRows, compareRows, routerDetail, cardStats } from "../src/app/lp/catalog/format.ts";

const PKGS = basePackages();
const byId = (id) => {
  const p = PKGS.find((x) => String(x.id) === String(id));
  assert.ok(p, `רשומה ${id} לא נמצאה בקטלוג`);
  return p;
};
const prose = (p) =>
  `${p.name ?? ""} ${p.description ?? ""} ${p.benefits ?? ""} ${p.priceAfterPromoNote ?? ""}`;
const rowOf = (rows, label) => rows.find((r) => r.label === label);

/* ── 1. יחידת המטבע: מחלקת גרשים ולא רשימת איותים ──────────────────── */

/*
 * ⚠️ האיות `ש''ח` (שני גרשים ישרים) חי בקטלוג, והגרש העברי `ש״ח`
 * שהרשימה הקודמת כן כיסתה — לא. הבדיקה נמדדת מול הקטלוג ולא מול
 * רשימה קבועה, כדי שהאיות הבא שהמחלץ יייצר ייתפס כאן.
 */
test("כל איות של יחידת המטבע שבקטלוג מכוסה בשער", () => {
  const SHEKEL_UNIT = /(?:₪|ש\s?["״'׳”“]{0,2}\s?ח)/;
  /*
   * ⚠️ רק הקיצור שצמוד למספר, ולא כל `ש…ח` בטקסט: `שיח` ו-`שח`
   * שבתוך מילה עברית אינם יחידת מטבע, ושער שהיה מכסה אותם היה
   * קורא מילים כסכומים.
   */
  const spellings = new Set();
  for (const p of PKGS) {
    for (const m of prose(p).matchAll(/\d[\d.,]*\s{0,2}(ש[^\sא-ת\d]{0,2}ח)/g)) spellings.add(m[1]);
    for (const m of prose(p).matchAll(/(ש[^\sא-ת\d]{0,2}ח)\s{0,2}\d/g)) spellings.add(m[1]);
  }
  assert.ok(spellings.size > 0, "לא נמצא אף איות של שקל בקטלוג");
  for (const s of spellings) {
    assert.match(s, SHEKEL_UNIT, `האיות ${JSON.stringify(s)} חי בקטלוג ואינו מכוסה`);
  }
  assert.ok(spellings.has("ש''ח"), "האיות שבגללו הורחב הקבוע נעלם מהקטלוג — יש למדוד מחדש");
});

/* ── 2. `סטרימר` הוא ממיר גם בקורא התקרות ─────────────────────────── */

/*
 * ⚠️ שני קוראים באותו קובץ על אותו ציוד: `CAP_UNITS` הכיר `ממיר`
 * לבדו ו-`CONVERTER_WORD` הכיר גם `סטרימר`. הקטלוג כותב `סטרימר`
 * ב-ids 158, 104 ו-72.
 */
test("סטרימר וממיר הם אותה יחידה בשני הקוראים", () => {
  const CAP = /ממיר|סטרימר/;
  const CONVERTER_WORD = /(?:ממיר|סטרימר)/;
  for (const word of ["ממיר", "ממירים", "סטרימר", "סטרימרים"]) {
    assert.match(word, CAP, `${word} אינו מזוהה בקורא התקרות`);
    assert.match(word, CONVERTER_WORD, `${word} אינו מזוהה בקורא העלות`);
  }
  const streamers = PKGS.filter((p) => /סטרימר/.test(prose(p))).map((p) => String(p.id));
  assert.deepEqual(streamers.sort(), ["104", "158", "72"].sort());
});

/* ── 3. "נתב כלול" הוא אותה הצהרה כמו "כולל נתב" ──────────────────── */

const ROUTER_BARE_IDS = ["157", "92", "102", "107", "108", "109"];

test("שש הרשומות שכותבות `נתב כלול` נקראות כהצהרה חיובית", () => {
  for (const id of ROUTER_BARE_IDS) {
    const p = byId(id);
    assert.match(prose(p), /נתב\s*כלול/, `id ${id} שינתה ניסוח`);
    assert.equal(routerDetail(p), "כלול במחיר", `id ${id} עדיין מוחזרת כ-null`);
  }
});

/*
 * ⚠️ הסדר ההפוך אינו צריך לוויין שלילי — ההכחשה נכתבת **בין** שתי
 * המילים, ולכן `\s{0,3}` אינו מכיל אותה. מקובע כאן, כי שער שנראה
 * חסר-גידור מזמין "תיקון" שישבור אותו.
 */
test("השלילה אינה נקראת כהצהרה חיובית בשני הסדרים", () => {
  const RE = /(?<!(?:לא|אינו|אינה|אינם|ללא)\s{0,3})כולל(?:ת|ים)?\s*(?:ה)?נתב|(?:ה)?נתב\s{0,3}כלול(?:ה|ים|ות)?/;
  for (const neg of ["לא כולל נתב", "ללא נתב", "נתב לא כלול", "נתב אינו כלול"]) {
    assert.doesNotMatch(neg, RE, `${JSON.stringify(neg)} נקרא כהצהרה חיובית`);
  }
  for (const pos of ["כולל נתב", "נתב כלול", "המחיר כולל נתב", "נתב כלולה"]) {
    assert.match(pos, RE, `${JSON.stringify(pos)} אינו נקרא`);
  }
});

/* ── 4. "מגדיל נוסף" בלי המילה "טווח" ────────────────────────────── */

/*
 * ⚠️ הניסוח הרוב בקטלוג הוא `מגדיל נוסף` — 11 רשומות — מול id 72
 * לבדה שכותבת `מגדיל טווח נוסף`. הרפיון חי בקורא העלות בלבד.
 */
test("קורא עלות המגדיל מכיר את הניסוח הרוב", () => {
  const LOOSE = /(?:מגדיל|מרחיב|מגביר)(?:\s*(?:ה)?טווח)?/;
  const STRICT = /(?:מגדיל|מרחיב|מגביר)\s*(?:ה)?טווח/;
  assert.match("מגדיל נוסף", LOOSE);
  assert.doesNotMatch("מגדיל נוסף", STRICT, "הניסוח הרוב חייב להיות מחוץ לשער ההכללה");
  assert.match("מגדיל טווח נוסף", STRICT);

  const bare = PKGS.filter((p) => /מגדיל\s+נוסף/.test(prose(p))).map((p) => String(p.id));
  assert.equal(bare.length, 11, `נמצאו ${bare.length} רשומות בניסוח הרוב — צפויות 11`);
});

/* ── 5. ארבעת התיקונים אינם מזיזים אף מספר או תווית על המסך ──────── */

/*
 * ⚠️ זה האינווריאנט שבגללו ארבעת התיקונים נפרסו: כל ארבעתם רדומים
 * בנתון של היום (השדה ב-`spec` ממולא ולכן `??` אינו מגיע לפרוזה),
 * והם נכתבו כדי שהרענון הבא לא יפול. השורות של שש רשומות הנתב כבר
 * הדפיסו "כלול במחיר" דרך `routerIncluded`; מה שהשתנה הוא שהקורא
 * של הפרוזה מסכים איתן במקום להכחיש אותן.
 */
test("שורת הנתב בשש הרשומות לא השתנתה על המסך", () => {
  for (const id of ROUTER_BARE_IDS) {
    const p = byId(id);
    const row = rowOf(detailRows(p), "נתב");
    assert.ok(row, `id ${id} איבדה את שורת הנתב`);
    /*
     * ⚠️ `match` ולא `equal`: בחלק מהרשומות השורה נושאת גם את
     * התוספת החודשית (id 92: `כלול במחיר · בתוספת ₪4.9 לחודש`).
     * מה שמקובע הוא שההצהרה החיובית נשארה בראש השורה — הסקירה
     * לפני/אחרי הראתה אפס תזוזה בכל 3,712 השורות.
     */
    assert.match(row.value, /^כלול במחיר/, `id ${id} מדפיסה ${row.value}`);
  }
});

test("אין שורת פירוט, אריח או תא השוואה שמכחיש את עצמו", () => {
  for (const p of PKGS) {
    for (const r of detailRows(p)) {
      assert.ok(typeof r.value === "string" && r.value !== "", `id ${p.id}: ${r.label} ריק`);
    }
    for (const s of cardStats(p)) {
      assert.ok(s.value != null && String(s.value) !== "", `id ${p.id}: אריח ריק`);
    }
  }
  // שורה ששני תאיה `—` היא שורה שלא היה צריך להדפיס כלל.
  const byCat = new Map();
  for (const p of PKGS) byCat.set(p.category, [...(byCat.get(p.category) ?? []), p]);
  for (const list of byCat.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        for (const row of compareRows([list[i], list[j]])) {
          assert.ok(
            !row.values.every((v) => v === "—"),
            `${list[i].id}|${list[j].id}: השורה ${row.label} ריקה בשני התאים`,
          );
        }
      }
    }
  }
});
