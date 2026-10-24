import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { resubmissionNotes } from "../src/app/lp/resubmission.ts";
import Module from "node:module";

/*
 * ⚠️ אותו stub שבראש `tools/lpBrowse.test.mjs` — השרשרת
 * `CatalogBrowser → PackageCard → LeadForm → ../actions` מגיעה למודול
 * `"use server"` ש-tsx אינו יכול לקמפל.
 */
const loadModule = Module._load;
Module._load = function (request, parent, isMain) {
  if (/(^|[\\/])actions(\\.ts)?$/.test(request)) {
    return { __esModule: true, submitLandingLead: async () => ({ ok: true }) };
  }
  return loadModule.call(this, request, parent, isMain);
};

const { priceBoundsOf } = await import("../src/app/lp/ui/CatalogBrowser.tsx");
import { basePackages, byCategory, listable } from "../src/app/lp/catalog/catalog.ts";

/*
 * ⚠️ סבב 42 — שלושה משטחים שהבטיחו יותר ממה שקיימו:
 *
 *   • המחשבון מדפיס מעל הטופס השני ששליחה נוספת תעדכן את
 *     אותה פנייה, וענף הכפילות עדכן שני שדות בלבד. שם מתוקן
 *     וספק שנבחר — שני השדות שהנציג מתקשר לפיהם — נזרקו.
 *   • סכום אבסורדי הדליק aria-invalid והרג את ה-CTA, וההסבר הופיע
 *     באותו אפור של הסתייגות הניטרלית.
 *   • תוויות המחוון הציגו ₪22 כקצה הקטלוג בזמן שהכרטיס הראשון
 *     מתחתיהן אומר ₪21.9.
 */

const lead = (over = {}) => ({
  name: "דנה כהן",
  packageName: "wecom300GB 5G · WeCom",
  currentProvider: undefined,
  notes: [{ body: "מהמחשבון: משלם היום ₪220 בחודש" }],
  ...over,
});
const input = (over = {}) => ({
  message: "",
  packageName: "",
  name: "",
  currentProvider: undefined,
  ...over,
});

test("סבב 42: שם מתוקן וספק חדש מגיעים לליד הקיים", () => {
  const notes = resubmissionNotes(
    input({ name: "דנה כהן-לוי", currentProvider: "cellcom" }),
    lead(),
  );
  assert.equal(notes.length, 2);
  assert.ok(notes.some((n) => n.includes("דנה כהן-לוי")));
  assert.ok(notes.some((n) => n.includes("הספק שנמסר")));
});

test("סבב 42: לחיצה כפולה אינה מוסיפה דבר", () => {
  const l = lead({ currentProvider: "cellcom" });
  assert.deepEqual(
    resubmissionNotes(
      input({ name: l.name, packageName: l.packageName, currentProvider: "cellcom" }),
      l,
    ),
    [],
  );
});

test("סבב 42: הערה שכבר רשומה אינה נכתבת פעמיים", () => {
  const line = "השם שנמסר בפנייה החוזרת: דנה כהן-לוי";
  const l = lead({ notes: [{ body: line }] });
  assert.deepEqual(resubmissionNotes(input({ name: "דנה כהן-לוי" }), l), []);
});

test("סבב 42: שם החבילה וההודעה ממשיכים לעבוד כמו קודם", () => {
  const notes = resubmissionNotes(
    input({ message: "אשמח לשיחה בערב", packageName: "טריפל פלוס 149" }),
    lead(),
  );
  assert.deepEqual(notes, [
    "אשמח לשיחה בערב",
    "התעניין גם ב: טריפל פלוס 149",
  ]);
});

const calcSrc = readFileSync("src/app/lp/ui/SavingsCalculator.tsx", "utf8");

test("סבב 42: סכום אבסורדי נראה שגוי גם למי שרואה", () => {
  // אותו תנאי בדיוק שמדליק את aria-invalid על השדה עצמו.
  assert.ok(
    calcSrc.includes("aria-invalid={invalidSpend || absurdHint || undefined}"),
  );
  assert.ok(
    calcSrc.includes("${invalidSpend || absurdHint ? \"font-medium text-lp-rise\" : \"text-lp-ink-2\"}"),
    "ההודעה חייבת צבע שגיאה בשני המצבים שמכריזים על שדה שגוי",
  );
  assert.ok(
    "ההודעה חייבת צבע שגיאה בשני המצבים שמכריזים על שדה שגוי",
  );
});

test("סבב 42: תוויות המחוון מצטטות מחירים שקיימים", () => {
  const live = listable(basePackages());
  for (const track of ["cellular", "home"]) {
    const pkgs = byCategory(live, track);
    const b = priceBoundsOf(pkgs);
    const prices = pkgs.map((p) => p.price).filter((v) => typeof v === "number" && v > 0);
    assert.equal(b.lowest, Math.min(...prices), track);
    assert.equal(b.highest, Math.max(...prices), track);
    assert.equal(b.min, Math.ceil(b.lowest), track);
  }
});
