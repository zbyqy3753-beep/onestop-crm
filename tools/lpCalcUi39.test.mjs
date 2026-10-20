import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module from "node:module";
import { test } from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { basePackages, listable } from "../src/app/lp/catalog/catalog.ts";

/*
 * ⚠️ `src/app/lp/actions.ts` מוחלף בבדיקה — אותו stub בדיוק כמו ב-
 * `tools/lpBrowse.test.mjs` ו-`tools/round38-browse.test.mjs`: שרשרת
 * הייבוא `CatalogTabs → CatalogBrowser → PackageCard → LeadForm →
 * ../actions` מגיעה למודול `"use server"` ש-tsx אינו יכול לקמפל, ואף
 * רכיב שנבדק כאן אינו קורא ל-Server Action.
 */
const loadModule = Module._load;
Module._load = function (request, parent, isMain) {
  if (/(^|[\\/])actions(\.ts)?$/.test(request)) {
    return { __esModule: true, submitLandingLead: async () => ({ ok: true }) };
  }
  return loadModule.call(this, request, parent, isMain);
};

const { CompareTray } = await import("../src/app/lp/ui/CompareTray.tsx");
const { CatalogBrowser } = await import("../src/app/lp/ui/CatalogBrowser.tsx");
const { CatalogTabs } = await import("../src/app/lp/ui/CatalogTabs.tsx");
const { PackageCard } = await import("../src/app/lp/ui/PackageCard.tsx");

const ROOT = new URL("../src/app/", import.meta.url);
const GLOBALS = readFileSync(new URL("globals.css", ROOT), "utf8");
const LP_CSS = readFileSync(new URL("lp/lp.css", ROOT), "utf8");
/*
 * ⚠️ בלי ההערות. הקבצים האלה מתעדים בגוף ההערה **מה** הוסר ולמה
 * ("מצב מושבת בטוקנים ולא ב-`opacity-40`"), ובדיקה שקוראת את הקובץ
 * הגולמי הייתה נכשלת על התיעוד של התיקון עצמו — כלומר מענישה דווקא
 * את ההסבר שמונע מהעמעום לחזור.
 */
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
const SRC = Object.fromEntries(
  ["SavingsCalculator", "CatalogBrowser", "CompareTray", "CatalogTabs"].map((name) => [
    name,
    code(readFileSync(new URL(`lp/ui/${name}.tsx`, ROOT), "utf8")),
  ]),
);

const ALL = listable(basePackages());
const CELL = ALL.filter((p) => p.category === "cellular");

const text = (html) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const tray = (items, max = 4) =>
  renderToStaticMarkup(
    React.createElement(CompareTray, { items, max, onRemove() {}, onClear() {} }),
  );

/* ────────────────────────────────────────────────────────────────────
 * ניגודיות — אותו חשב שה-WCAG מגדיר, על הטוקנים עצמם
 *
 * ⚠️ הערכים נקראים מ-`globals.css` ולא כתובים כאן. בדיקה שמקבעת
 * `#7d8b99` כמחרוזת מפסיקה לבדוק את המסך ברגע שהטוקן מתעדכן — היא
 * תמשיך לאשר שהמספר הישן נכשל בזמן שהמסך מציג צבע אחר.
 * ──────────────────────────────────────────────────────────────────── */

function token(name) {
  const m = GLOBALS.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(m, `הטוקן --color-${name} אינו מוגדר ב-globals.css`);
  return [1, 3, 5].map((i) => parseInt(m[1].slice(i, i + 2), 16));
}

const channel = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = (rgb) =>
  0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
const ratio = (a, b) => {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
/** מה שהעין רואה כשאלמנט בצבע `fg` מצויר ב-`alpha` מעל `bg`. */
const over = (fg, bg, alpha) => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));

const WHITE = token("lp-surface");
const BRAND = token("lp-brand");
const INK_2 = token("lp-ink-2");
const INK_3 = token("lp-ink-3");
const INVERT = token("lp-ink-invert");
const AA = 4.5;

/*
 * שלוש העמעומים שהדף השתמש בהם כדי לסמן "מושבת" — וכמה הם באמת.
 * `aria-disabled` פוטר אותם מ-1.4.3 פורמלית; הבדיקה הזו היא על מה
 * שאפשר לקרוא בפועל בטלפון, ולכן היא מחשבת ולא מצטטת.
 */
test("ניגודיות: עמעום כ'מושבת' מוריד את הכיתוב מתחת לקריאוּת", () => {
  /* תווית תיבת ההשוואה בכרטיס: `text-lp-ink-3 opacity-50` על לבן, 11px. */
  assert.ok(
    ratio(over(INK_3, WHITE, 0.5), WHITE) < 2,
    "ink-3 ב-50% על לבן אינו מתחת ל-2:1 — ההנחה של הבדיקה התיישנה",
  );
  /* כפתור מותג ב-`opacity-40`: הטקסט הלבן נשאר לבן, הרקע מתבהר. */
  assert.ok(
    ratio(INVERT, over(BRAND, WHITE, 0.4)) < 2,
    "כפתור מותג ב-40% אינו מתחת ל-2:1 — ההנחה של הבדיקה התיישנה",
  );
  /* ושני התחליפים שנבחרו עומדים ב-AA מול הרקע שעליו הם באמת יושבים. */
  assert.ok(ratio(INK_2, WHITE) >= AA, "lp-ink-2 על לבן אינו עובר AA");
  assert.ok(
    ratio(INK_2, token("lp-surface-3")) >= AA,
    "lp-ink-2 על lp-surface-3 אינו עובר AA",
  );
});

/*
 * ⚠️ מונה שמעומעם ב-`opacity-70` נקרא 3.9:1 בשני המצבים — לבן על
 * המותג בלשונית הפעילה, ו-ink-2 על לבן בלשונית הכבויה — בעוד הוא
 * 11-14px. זה אותו נתון שה-`aria-label` של אותו פקד טורח להכריז
 * במילים ("סלולר — 55 חבילות"), כלומר המסך מעמעם דווקא את מה
 * שהוכרז כמידע.
 */
test("ניגודיות: המונה על הלשונית ועל שבב הסוג אינו מעומעם", () => {
  assert.ok(
    ratio(over(INVERT, BRAND, 0.7), BRAND) < AA,
    "לבן ב-70% על המותג עובר AA — ההנחה של הבדיקה התיישנה",
  );
  assert.ok(
    ratio(over(INK_2, WHITE, 0.7), WHITE) < AA,
    "ink-2 ב-70% על לבן עובר AA — ההנחה של הבדיקה התיישנה",
  );

  const tabs = renderToStaticMarkup(React.createElement(CatalogTabs, { packages: ALL }));
  assert.ok(!/opacity-70/.test(tabs), "לשוניות הקטלוג מעמעמות את המונה ב-opacity-70");

  const browser = renderToStaticMarkup(
    React.createElement(CatalogBrowser, { packages: CELL, category: "cellular" }),
  );
  assert.ok(!/opacity-70/.test(browser), "שבב הסוג מעמעם את המונה ב-opacity-70");

  /* המונה עצמו עדיין על המסך — לא "תוקן" בהסרתו. */
  assert.ok(/\d/.test(text(tabs)), "המונה נעלם מהלשוניות");
});

/*
 * ⚠️ פקד מושבת מסומן בטוקן ולא ב-`opacity`. שלושת המופעים —
 * "בחרו עוד חבילה" במגש, ה-CTA של המחשבון ו-"נקה הכל" בעמודת
 * המסננים — כולם `aria-disabled`, ולכן פטורים מ-1.4.3 פורמלית;
 * 1.7:1 בכל זאת אינו ניתן לקריאה, וה-CTA של המחשבון הוא המסך
 * **היחיד** שאומר לגולש למה הכפתור אינו פועל.
 *
 * ⚠️ נבדק גם על המקור ולא רק על הרינדור: ה-CTA של המחשבון חי בשלב 1,
 * ורינדור סטטי של הרכיב מגיע לשלב 0 בלבד — אין דרך להקליק בבדיקה
 * שאין בה DOM.
 */
test("מושבת: הכיתוב אינו מעומעם ב-opacity", () => {
  for (const [name, src] of Object.entries(SRC)) {
    assert.ok(
      !/opacity-40/.test(src),
      `${name}: מסמן מצב מושבת ב-opacity-40 (1.7:1 — ראה בדיקת הניגודיות)`,
    );
    assert.ok(!/opacity-70/.test(src), `${name}: מעמעם כיתוב ב-opacity-70`);
  }
  /* והכיתוב עצמו נשאר — הוא ההסבר היחיד למה אי אפשר להשוות. */
  assert.ok(text(tray(CELL.slice(0, 1))).includes("בחרו עוד חבילה"));
});

/* ────────────────────────────────────────────────────────────────────
 * תווית ההשוואה החסומה בכרטיס — תוקנה ב-`lp.css`, כי `PackageCard`
 * מחוץ לתחום של הסבב הזה. ⚠️ ולכן הבדיקה מאמתת את **שני** הצדדים:
 * הכלל קיים, ונקודת העגינה שהוא נשען עליה (`aria-disabled` על תיבת
 * ההשוואה) עדיין מרונדרת. בלי הצד השני, שינוי בכרטיס היה מבטל את
 * התיקון בשקט — `:has()` שאינו תואם אינו שגיאה.
 * ──────────────────────────────────────────────────────────────────── */
test("כרטיס: תווית ההשוואה החסומה מקבלת צבע קריא מ-lp.css", () => {
  const card = renderToStaticMarkup(
    React.createElement(PackageCard, {
      pkg: CELL[0],
      compareFull: true,
      compareChecked: false,
      onCompareToggle() {},
    }),
  );
  assert.match(
    card,
    /<label[^>]*>\s*<input[^>]*aria-disabled="true"/,
    "תיבת ההשוואה החסומה אינה `aria-disabled` בתוך `<label>` — הכלל ב-lp.css אינו תואם",
  );
  assert.ok(text(card).includes("השוואה"), "תווית ההשוואה נעלמה מהכרטיס");

  const rule = LP_CSS.match(/[^}]*aria-disabled="true"[^{]*\{[^}]*\}/);
  assert.ok(rule, "lp.css אינו מתקן את תווית ההשוואה החסומה");
  assert.match(rule[0], /--color-lp-ink-2/, "התיקון אינו משתמש בטוקן הקיים");
  assert.match(rule[0], /opacity:\s*1/, "התיקון אינו מבטל את העמעום של התווית");
});

/* ────────────────────────────────────────────────────────────────────
 * המונה "להשוואה (n/4)" — אזור חי
 * ──────────────────────────────────────────────────────────────────── */

const liveRegions = (html) =>
  [...html.matchAll(/<[a-z]+[^>]*aria-live="polite"[^>]*>([\s\S]*?)<\/[a-z]+>/g)].map((m) =>
    text(m[1]),
  );

/*
 * ⚠️ האזור החי קיים כבר כשאין אף פריט. אזור חי שנכנס ל-DOM **יחד**
 * עם התוכן שלו אינו מוכרז — ולכן דווקא ההוספה הראשונה, זו שבונה את
 * המגש, היא זו שהייתה נשארת שקטה.
 */
test("מגש: מונה ההשוואה מוכרז — גם בהוספה הראשונה", () => {
  assert.ok(
    liveRegions(tray([])).length > 0,
    "המגש הריק אינו מרנדר אזור חי — ההוספה הראשונה לא תוכרז",
  );

  const one = liveRegions(tray(CELL.slice(0, 1))).join(" ");
  assert.match(one, /1/, `האזור החי אינו אומר כמה נבחרו: ${one}`);
  assert.match(one, /4/, `האזור החי אינו אומר את התקרה: ${one}`);

  const two = liveRegions(tray(CELL.slice(0, 2))).join(" ");
  assert.notStrictEqual(two, one, "האזור החי אינו משתנה כשנוספת חבילה");
  assert.match(two, /2/, `האזור החי אינו אומר כמה נבחרו: ${two}`);
});

/*
 * ⚠️ ולא פעמיים. הכיתוב הנראה ("להשוואה (2/4)") והאזור החי אומרים את
 * אותו נתון, ושניהם בעץ הנגישות — קורא מסך שהגיע למגש היה שומע את
 * המונה פעמיים ברצף.
 */
test("מגש: המונה אינו מוכרז פעמיים", () => {
  const html = tray(CELL.slice(0, 2));
  assert.match(
    html,
    /aria-hidden="true"[^>]*>\s*להשוואה|להשוואה[\s\S]{0,40}aria-hidden="true"/,
    "הכיתוב הנראה של המונה אינו מוסתר מקורא מסך לצד האזור החי",
  );
});

/* ────────────────────────────────────────────────────────────────────
 * מחוון המחיר
 *
 * ⚠️ `aria-label="מחיר מקסימלי"` נאמר, אבל הערך הוכרז כמספר עירום:
 * קורא מסך אמר "מחיר מקסימלי, 250" — בלי יחידה, בפקד שכל התצוגה
 * הוויזואלית שלו (הכותרת והקצוות) מדפיסה ₪. `aria-valuetext` הוא
 * השדה היחיד שמחליף את ההכרזה המספרית.
 * ──────────────────────────────────────────────────────────────────── */
test("מחוון: הערך מוכרז בשקלים ולא כמספר עירום", () => {
  const html = renderToStaticMarkup(
    React.createElement(CatalogBrowser, { packages: CELL, category: "cellular" }),
  );
  const m = html.match(/<input[^>]*type="range"[^>]*>/);
  assert.ok(m, "מחוון המחיר אינו מרונדר בסלולר");
  assert.match(m[0], /aria-valuetext="₪[^"]+"/, `המחוון מכריז מספר בלי יחידה: ${m[0]}`);
});
