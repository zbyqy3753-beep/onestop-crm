/**
 * ממיר את שמות טוקני העיצוב בקבצים שהועתקו מ-`onestop-site` לקידומת `lp-`.
 *
 * ⚠️ הכרחי, לא קוסמטי: לשני הפרויקטים יש בלוק `@theme` עם **אותם שמות**
 * (`surface`, `ink-2`, `line`, `brand`) וערכים שונים — ובלי הקידומת
 * הקומפוננטות המועתקות היו נצבעות בטוקנים של ה-CRM, כלומר בתמה הכהה
 * שלו, על דף שכולו לבן.
 *
 * הרצה חד-פעמית אחרי העתקת קובץ מהאתר:
 *   node tools/lp-prefix-tokens.mjs src/app/lp/ui/Foo.tsx
 */
import { readFileSync, writeFileSync } from "node:fs";

/** ⚠️ הארוך לפני הקצר — אחרת `ink` היה בולע את `ink-2`. */
const TOKENS = [
  "navy-deep", "navy-line", "navy-2", "navy-3", "navy",
  "brand-bright", "brand-glow", "brand",
  "surface-2", "surface-3", "surface",
  "line-strong", "line",
  "ink-invert", "ink-2", "ink-3", "ink",
  "on-navy-2", "on-navy-3", "on-navy",
  "rise-soft", "rise", "save", "silver", "whatsapp",
];

const UTIL =
  "(?:bg|text|border|ring|accent|fill|stroke|from|to|via|decoration|outline|divide|placeholder|caret|shadow)";

/*
 * גבולות המחלקה: רווח, גרש, גרשיים, בקטיק, נקודתיים (וריאנט כמו
 * `hover:`), וסוגר מסולסל של תבנית. נכתב כתווים מפורשים ולא כ-`\s`
 * בכוונה — מחרוזת רגילה בולעת את הלוכסן, וזה בדיוק מה שהשתבש קודם.
 */
const OPEN = "[ \\t\"'`:{]";
const CLOSE = "[ \\t\"'`/\\]}]";

const SIMPLE = [
  ["rounded-card", "rounded-lp-card"],
  ["rounded-t-card", "rounded-t-lp-card"],
  ["text-2xs", "text-lp-2xs"],
  ["shadow-card", "shadow-lp-card"],
  ["shadow-lift", "shadow-lp-lift"],
  ["shadow-pop", "shadow-lp-pop"],
  ["animate-rise", "animate-lp-rise"],
];

/** נתיבי הייבוא: המודולים יושבים עכשיו ליד הקומפוננטות. */
const IMPORTS = [
  ["@/lib/types", "../catalog/types"],
  ["@/lib/format", "../catalog/format"],
  ["@/lib/catalog", "../catalog/catalog"],
  ["@/lib/providers", "../catalog/providers"],
];

function prefix(source) {
  let s = source;

  for (const t of TOKENS) {
    s = s.replace(new RegExp(`(${OPEN})(${UTIL})-${t}(?=${CLOSE}|$)`, "g"), `$1$2-lp-${t}`);
  }
  for (const [from, to] of SIMPLE) {
    s = s.replace(new RegExp(`(${OPEN})${from}(?=${CLOSE}|$)`, "g"), `$1${to}`);
  }
  for (const [from, to] of IMPORTS) s = s.replaceAll(from, to);

  return s;
}

let changed = 0;
for (const file of process.argv.slice(2)) {
  const before = readFileSync(file, "utf8");
  const after = prefix(before);
  if (after !== before) changed++;
  writeFileSync(file, after, "utf8");
  console.log(`${after === before ? "unchanged" : "prefixed "} ${file}`);
}
console.log(`\n${changed} קבצים שונו.`);
