import assert from "node:assert/strict";
import { test } from "node:test";

import { basePackages, listable } from "../src/app/lp/catalog/catalog.ts";
import { discountIsCapped, discountScope, priceNote, promoRise } from "../src/app/lp/catalog/format.ts";
import { studioPackage, studioPackages } from "../src/lib/posts/catalog.ts";
import { comparePost, headlineText, spotlightPost } from "../src/lib/posts/templates.ts";

/*
 * ⚠️ סבב 34 — צד הסטודיו של ארבעת השערים שחוברו לכרטיס ב-`/lp` ולא
 * למשטח שמפרסם בשם של אלירן: `discountIsCapped`, `discountScope`,
 * `priceNote` (דרך `proseFloorsAt` / `requiresMultipleLines`) וענפי
 * ה-`note`/`period` של `promoRise`.
 *
 * ⚠️ חלק מהבדיקות רצות על הקטלוג החי (כל ארבעת הפגמים **חיים**
 * ב-14.8.2026) וחלק על רשומות מסונתזות — מלכודות לרענון הבא, שהקטלוג
 * של היום נקי מהן. בדיקה שרצה על הקטלוג בלבד הייתה עוברת גם אחרי
 * שהרשומה תצא ממנו, בלי לבדוק כלום.
 */

const live = listable(basePackages());
const byId = (id) => {
  const p = live.find((x) => x.id === id);
  assert.ok(p, `id ${id} אינו בקטלוג החי — עדכן את הבדיקה, לא את הקוד`);
  return p;
};
const studioById = (id) => studioPackage(byId(id));
const spotlight = (id) => spotlightPost(studioById(id));
const captionLines = (post) => post.caption.split("\n");
const cardRows = (post) => post.slides.flatMap((s) => (s.kind === "card" ? (s.rows ?? []) : []));

/** הנוסח שהיה מודפס על כל רשומה שלא נמסר ממנה מספר — גם כשכן אמרה משהו. */
const OLD_DEFAULT = "לפני שמצטרפים, כדאי לבדוק מה קורה למחיר כשההטבה נגמרת.";

/* ── פריט 1: `after` לא יכול להחזיק נוסח ─────────────────────────── */

test("ענף ה-note: הכיתוב מצטט את נוסח הרשומה ולא מכחיש אותה", () => {
  const noteIds = live.filter((p) => promoRise(p)?.kind === "note").map((p) => p.id);
  assert.deepEqual(
    [...noteIds].sort(),
    ["108", "109", "132", "23", "42", "58", "61", "81", "83", "85", "92"],
    "רשימת הרשומות עם נוסח מילולי השתנתה — ודא שהבדיקות עדיין מכסות אותן",
  );
  for (const id of noteIds) {
    const sp = studioById(id);
    assert.equal(sp.after, null, `id ${id}: אין מספר, רק נוסח`);
    assert.equal(sp.afterNote, promoRise(byId(id)).note);
    const lines = captionLines(spotlightPost(sp));
    assert.ok(lines.includes(OLD_DEFAULT) === false, `id ${id}: ברירת המחדל הגורפת חזרה`);
    assert.ok(
      lines.some((l) => l.includes(`"${sp.afterNote}"`)),
      `id ${id}: הנוסח של הרשומה אינו מצוטט בכיתוב`,
    );
  }
});

test("שער הכיוון: 'המחיר עולה' רק כשכל המספרים שבנוסח גבוהים מ-price", () => {
  const rises = live.map(studioPackage).filter((p) => p.afterRises).map((p) => p.id);
  assert.deepEqual([...rises].sort(), ["42", "61", "83"]);
  // ids 92, 108, 109 מוסרות מחיר **נמוך** מ-`price`; 23, 58, 81, 85, 132 מצטטות
  // גם את מחיר המבצע הזול וגם את מחיר הקבע, ו-`price` הוא כבר הקבע.
  for (const id of ["23", "58", "81", "85", "92", "108", "109", "132"]) {
    const sp = studioById(id);
    assert.equal(sp.afterRises, false, `id ${id}: שער הכיוון נפתח בטעות`);
    const caption = spotlightPost(sp).caption;
    assert.ok(!caption.includes("המחיר עולה"), `id ${id}: הכיתוב טוען עלייה שלא הוכחה`);
  }
  for (const id of ["42", "61", "83"]) {
    assert.ok(spotlight(id).caption.includes("המחיר עולה"), `id ${id}: עלייה מוכחת לא נאמרה`);
  }
});

test("ענף ה-period: נאמר שיש תקופת מבצע, בלי לטעון כיוון", () => {
  const ids = live.map(studioPackage).filter((p) => p.promoPeriod).map((p) => p.id);
  // 19 מענף ה-`period` של `promoRise` + 6 שבהן `trustedAfter` פסל את
  // המספר (11, 16, 28, 70, 90, 123 — התיאור סותר את השדה, או שהשם
  // מוכר קבוצת קווים ואז "מחיר לקו" מטעה בשני הכיוונים).
  // ⚠️ 26 ולא 25 מאז סבב 37: `חודשיים 149 שח` ב-id 112 הוא הצהרת מבצע
  // בצורה החשופה, ועד אז אף שער נוסח לא קרא אותה.
  assert.equal(ids.length, 26);
  assert.ok(ids.includes("112"), "id 112: הצהרת 'חודשיים <מחיר>' לא הגיעה לסטודיו");
  for (const id of ["45", "67", "71", "72", "73", "98", "124", "125", "153", "159", "17"]) {
    assert.ok(ids.includes(id), `id ${id}: ענף ה-period לא הגיע לסטודיו`);
  }
  for (const id of ["11", "16", "28", "70", "90", "123"]) {
    const sp = studioById(id);
    assert.equal(sp.after, null, `id ${id}: מספר שנפסל ב-trustedAfter התפרסם`);
    assert.equal(sp.promoPeriod, true, `id ${id}: תקופת המבצע נשמטה`);
  }
  for (const id of ids) {
    const post = spotlightPost(studioById(id));
    assert.ok(!post.caption.includes(OLD_DEFAULT), `id ${id}: ברירת המחדל הגורפת חזרה`);
    assert.ok(!post.caption.includes("המחיר עולה"), `id ${id}: טענת עלייה בלי מספר`);
    assert.ok(post.caption.includes("תקופת מבצע"), `id ${id}: תקופת המבצע לא נאמרה בכיתוב`);
    assert.ok(
      cardRows(post).some((r) => r.label === "אחרי תום ההטבה" && r.value === "יש תקופת מבצע"),
      `id ${id}: אין שורה על התקופה שאחרי ההטבה`,
    );
  }
});

test("מספר אמין ממשיך להתפרסם כמספר", () => {
  const sp = studioById("87");
  assert.equal(sp.after, 69.9);
  const post = spotlightPost(sp);
  assert.ok(
    cardRows(post).some((r) => r.label === "אחרי תום ההטבה" && r.value === "₪69.9" && r.from === "₪39.9"),
  );
  assert.ok(post.caption.includes("המחיר עולה ל-₪69.9"));
});

/* ── פריט 2: ארבעת השערים שלא הגיעו לתבניות ──────────────────────── */

test("discountIsCapped: ids 135 ו-142 מדפיסות 'עד' ולא שיעור אחיד", () => {
  const capped = live.filter(discountIsCapped).map((p) => p.id);
  assert.deepEqual([...capped].sort(), ["135", "142"]);
  for (const id of capped) {
    const sp = studioById(id);
    assert.equal(sp.discountIsCapped, true);
    assert.ok(headlineText(sp).startsWith("עד 10% הנחה"), `id ${id}: ${headlineText(sp)}`);
    assert.ok(spotlight(id).slides[0].title.block.startsWith("עד "));
  }
  // ושיעור שאינו תקרה נשאר בלי "עד": id 150 מצהיר על 20% אחיד.
  assert.ok(!headlineText(studioById("150")).startsWith("עד "));
});

test("discountScope: 10 מסלולי חשמל אומרים על מה ההנחה חלה", () => {
  const scoped = live.filter((p) => discountScope(p)).map((p) => p.id);
  assert.deepEqual(
    [...scoped].sort(),
    ["134", "135", "136", "137", "140", "142", "146", "147", "149", "150"],
  );
  for (const id of scoped) {
    const sp = studioById(id);
    const scope = discountScope(byId(id));
    assert.equal(sp.discountScope, scope);
    assert.ok(headlineText(sp).endsWith(`על ${scope}`), `id ${id}: ${headlineText(sp)}`);
    const caption = spotlight(id).caption;
    assert.ok(caption.includes(`${scope} בחשבון בלבד`), `id ${id}: ההסתייגות נשמטה מהכיתוב`);
    assert.ok(!caption.includes(OLD_DEFAULT), `id ${id}: נאמר על מסלול הנחה שההטבה נגמרת`);
  }
  // מסלול בלי הצהרת רכיב נשאר בלי המצאה: id 143.
  assert.equal(studioById("143").discountScope, null);
  assert.equal(headlineText(studioById("143")), "8% הנחה");
});

test("priceNote: הרצפה של id 85 וההתניה בכמות מנויים נאמרות בשקף הפתיח", () => {
  const sp = studioById("85");
  assert.equal(sp.priceNote, "המחיר הוא מחיר התחלתי ולא מחיר אחיד");
  const hook = spotlight("85").slides[0];
  assert.equal(hook.sub, "המחיר הוא מחיר התחלתי ולא מחיר אחיד. כדאי לדעת מה באמת כלול.");
  assert.ok(hook.sub.includes(hook.underline ?? ""), "המרקר הצהוב חייב להופיע בשורה");

  const multi = studioById("110");
  assert.equal(multi.priceNote, "המחיר מותנה בכמות המנויים בחבילה");
  assert.ok(spotlight("110").slides[0].sub.startsWith("המחיר מותנה בכמות המנויים"));

  // חשמל: ההסתייגות נאמרת דרך `discountScope` בכותרת, ולא פעמיים.
  for (const p of live.filter((x) => x.category === "electricity")) {
    assert.equal(studioPackage(p).priceNote, null, `id ${p.id}: הסתייגות כפולה`);
  }
  // רשומה בלי הסתייגות שומרת על הנוסח המקורי.
  assert.equal(studioById("87").priceNote, null);
  assert.equal(spotlight("87").slides[0].sub, "לפני שמצטרפים, כדאי לדעת מה באמת כלול.");
});

test("כל הסתייגות שהכרטיס ב-lp מראה מגיעה גם לסטודיו", () => {
  for (const p of live) {
    const note = priceNote(p);
    const sp = studioPackage(p);
    if (!note) continue;
    if (p.category === "electricity") {
      assert.ok(sp.discountScope, `id ${p.id}: הכרטיס מסתייג והסטודיו לא`);
    } else {
      assert.equal(sp.priceNote, note.value, `id ${p.id}: הכרטיס מסתייג והסטודיו לא`);
    }
  }
});

/* ── טבלת ההשוואה: אותם שערים, באותה טבלה שמשווה מספרים ──────────── */

test("comparePost: אחוז מדורג ושיוך הרכיב לא נעלמים בהשוואה", () => {
  const rows = comparePost(["150", "147", "135", "142"].map(studioById)).slides[1].rows;
  assert.deepEqual(
    rows.map((r) => r.value),
    ["20%", "20%", "עד 10%", "עד 10%"],
  );
  for (const r of rows) assert.ok(r.sub.includes("על רכיב"), r.sub);
});

test("comparePost: רשומה שהצהירה בפרוזה אינה נראית כמי שלא הצהירה", () => {
  const rows = comparePost(["85", "98"].map(studioById)).slides[1].rows;
  for (const r of rows) assert.ok(r.sub.includes("יש תקופת מבצע"), r.sub);
  const known = comparePost(["87", "91"].map(studioById)).slides[1].rows;
  assert.ok(known[0].sub.includes("אחר כך ₪"));
});

/* ── אינווריאנט ציור: `row.value` מצויר בלי גלישה ────────────────── */

test("אין ערך שורה שארוך מ-22 תווים בכל הקטלוג", () => {
  /*
   * `renderSlide.ts:464` מצייר `row.value` ב-`fillText` יחיד, בגופן 42
   * bold, מול תווית שמצוירת מימין באותה שורה — בלי `wrap` ובלי קיצור.
   * נוסח ארוך היה נדרס על התווית ויוצא מהכרטיס, ולכן הנוסח המלא חי
   * בכיתוב (טקסט) והשקף מקבל את העובדה.
   */
  const all = studioPackages();
  for (const sp of all) {
    for (const r of cardRows(spotlightPost(sp))) {
      assert.ok(r.value.length <= 22, `id ${sp.id}: ערך באורך ${r.value.length} — "${r.value}"`);
    }
  }
  const home = all.filter((p) => p.category === "home").slice(0, 4);
  for (const r of comparePost(home).slides[1].rows) {
    assert.ok(r.value.length <= 22, r.value);
  }
});

/* ── מלכודות לרענון הבא: רשומות מסונתזות ─────────────────────────── */

const provider = { slug: "x", name: "ספק", logo: "", raw: null };

function pkg(over = {}) {
  return {
    id: "s1",
    slug: "s1",
    category: "cellular",
    categoryHe: "סלולר",
    name: "חבילה",
    type: null,
    badges: [],
    recommended: false,
    provider,
    description: null,
    benefits: null,
    crmOrderUrl: "",
    priceAfterPromoNote: null,
    priceModel: "monthly",
    price: 50,
    priceAfterPromo: null,
    spec: { dataGb: 100, minutes: null, sms: null, intlMinutes: null, unlimitedData: false },
    ...over,
  };
}

test("נוסח שהמספר שבו נמוך מ-price לא יהפוך ל'המחיר עולה'", () => {
  const sp = studioPackage(pkg({ price: 120, priceAfterPromoNote: "לאחר שנה 99 ₪ לחודש" }));
  assert.equal(sp.afterNote, "לאחר שנה 99 ₪ לחודש");
  assert.equal(sp.afterRises, false);
  const caption = spotlightPost(sp).caption;
  assert.ok(!caption.includes("המחיר עולה"));
  assert.ok(caption.includes('"לאחר שנה 99 ₪ לחודש"'));
});

test("נוסח שכל מספריו גבוהים מ-price כן נאמר ככיווני", () => {
  const sp = studioPackage(pkg({ price: 39.9, priceAfterPromoNote: "אחרי שנה 79 ₪" }));
  assert.equal(sp.afterRises, true);
  assert.ok(spotlightPost(sp).caption.includes("המחיר עולה"));
});

test("price שאינו מספר אינו פותח את שער הכיוון", () => {
  for (const price of [null, 0, Number.NaN]) {
    const sp = studioPackage(pkg({ price, priceAfterPromoNote: "לאחר מכן 99 ₪" }));
    assert.equal(sp.afterRises, false, `price ${String(price)}`);
  }
});

test("נוסח בלי מספר נאמר כמות שהוא, בלי כיוון", () => {
  const sp = studioPackage(pkg({ priceAfterPromoNote: "המחיר ישתנה בתום התקופה" }));
  assert.equal(sp.afterRises, false);
  const caption = spotlightPost(sp).caption;
  assert.ok(caption.includes('"המחיר ישתנה בתום התקופה"'));
  assert.ok(!caption.includes("המחיר עולה"));
});

test("חשמל מסונתז: תקרה ורכיב יחד, בלי אמירה כפולה", () => {
  const sp = studioPackage(
    pkg({
      category: "electricity",
      categoryHe: "חשמל",
      price: null,
      priceModel: "discount",
      discountPercent: 12,
      description: "הנחה של עד 12% על רכיב התשלום המשתנה בלבד",
      spec: { discountPercent: 12, allHours: true, hoursText: null, customerType: "private" },
    }),
  );
  assert.equal(sp.discountIsCapped, true);
  assert.equal(sp.discountScope, "רכיב התשלום המשתנה");
  assert.equal(headlineText(sp), "עד 12% הנחה על רכיב התשלום המשתנה");
  const post = spotlightPost(sp);
  assert.equal(post.slides[0].title.block, "עד 12% הנחה על רכיב התשלום המשתנה");
  assert.ok(post.caption.includes("רכיב התשלום המשתנה בחשבון בלבד"));
  assert.ok(!post.caption.includes(OLD_DEFAULT));
});

test("מסלול חשמל בלי הצהרת רכיב אינו מקבל הסתייגות שהומצאה", () => {
  const sp = studioPackage(
    pkg({
      category: "electricity",
      categoryHe: "חשמל",
      price: null,
      priceModel: "discount",
      discountPercent: 7,
      spec: { discountPercent: 7, allHours: true, hoursText: null, customerType: "private" },
    }),
  );
  assert.equal(headlineText(sp), "7% הנחה");
  assert.ok(spotlightPost(sp).caption.includes("על מה בדיוק ההנחה חלה"));
});

test("רצפה מסונתזת: המחיר הגדול לא נשאר לבד", () => {
  const sp = studioPackage(pkg({ price: 100, description: 'מ-100 ₪ לחודש' }));
  assert.equal(sp.priceNote, "המחיר הוא מחיר התחלתי ולא מחיר אחיד");
  assert.ok(spotlightPost(sp).slides[0].sub.startsWith("המחיר הוא מחיר התחלתי"));
});

test("spec פגום לא מפיל את התבנית גם עם השדות החדשים", () => {
  for (const spec of [null, "x", []]) {
    const sp = studioPackage(pkg({ spec, priceAfterPromoNote: "לאחר מכן 99 ₪" }));
    assert.doesNotThrow(() => spotlightPost(sp));
  }
});
