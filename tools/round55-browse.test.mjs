import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module from "node:module";
import { test } from "node:test";

/*
 * ⚠️ אותו stub שבראש `tools/round46-browse.test.mjs` — השרשרת
 * `CatalogBrowser → PackageCard → LeadForm → ../actions` מגיעה למודול
 * `"use server"` ש-tsx אינו יכול לקמפל.
 */
const loadModule = Module._load;
Module._load = function (request, parent, isMain) {
  if (/(^|[\/])actions(\.ts)?$/.test(request)) {
    return { __esModule: true, submitLandingLead: async () => ({ ok: true }) };
  }
  return loadModule.call(this, request, parent, isMain);
};

const { basePackages, byCategory, listable, providers, providerSlug, CATEGORY_ORDER } =
  await import("../src/app/lp/catalog/catalog.ts");
const { hasAnyFilterControl } = await import("../src/app/lp/ui/CatalogBrowser.tsx");

const BROWSER = readFileSync("src/app/lp/ui/CatalogBrowser.tsx", "utf8");
const TRAY = readFileSync("src/app/lp/ui/CompareTray.tsx", "utf8");
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

const P = listable(basePackages());

/* ── 1. העמודה הצדדית יורדת עם הכרטיס שהיא החזיקה ──────────────── */

test("סבב 55: גם הרשת וגם ה-`aside` מגודרים ב-`showFilterCard`", () => {
  const CODE = code(BROWSER);
  assert.match(
    CODE,
    /className=\{showFilterCard \? "grid gap-6 lg:grid-cols-\[16rem_1fr\]" : "grid gap-6"\}/,
  );
  assert.match(CODE, /\{showFilterCard && \(\s*<aside/);
  // ולא הכרטיס לבדו בתוך `aside` שנשאר תמיד.
  assert.doesNotMatch(CODE, /<aside[^>]*>\s*\{showFilterCard && \(/);
});

test("והראיה: `/lp/provider/bezeq-energy` הוא המקטע היחיד בלי פקד סינון", () => {
  const empty = [];
  const noFilters = { providers: [], types: [], maxPrice: null };
  for (const provider of providers(basePackages())) {
    const mine = P.filter((p) => providerSlug(p) === provider.slug);
    for (const category of CATEGORY_ORDER) {
      const pkgs = byCategory(mine, category);
      if (pkgs.length === 0) continue;
      if (!hasAnyFilterControl(pkgs, noFilters)) empty.push(`${provider.slug}/${category}`);
    }
  }
  assert.deepEqual(empty, ["bezeq-energy/electricity"]);
});

/* ── 2. הפוקוס אינו נופל לראש הדף כשהמגש מתפרק ─────────────────── */

test("סבב 55: למגש יש נקודת אחיזה אחרונה, והיא פקד שתמיד מרונדר", () => {
  const TRAY_CODE = code(TRAY);
  assert.match(TRAY_CODE, /fallbackFocusId\?: string;/);
  // שני המסלולים — ✕ של שבב ו"נקה" — נופלים לאותה נקודה.
  assert.match(TRAY_CODE, /\(next \?\? inTray \?\? fallback\(\)\)\?\.focus\(\);/);
  assert.match(TRAY_CODE, /if \(cleared != null\) fallback\(\)\?\.focus\(\);/);

  const CODE = code(BROWSER);
  // ה-`select` של המיון מרונדר ללא תנאי בשורת התוצאות.
  assert.match(CODE, /id=\{sortId\}/);
  assert.match(CODE, /fallbackFocusId=\{sortId\}/);
  assert.doesNotMatch(CODE, /\{[^}]*&&[^}]*\(\s*<select\s+id=\{sortId\}/);
});
