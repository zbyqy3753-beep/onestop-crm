import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import { basePackages } from "../src/app/lp/catalog/catalog.ts";
import { compareRows, priceNote } from "../src/app/lp/catalog/format.ts";
import { CompareSheet } from "../src/app/lp/ui/CompareTray.tsx";

const P = basePackages();
const byId = (id) => {
  const p = P.find((x) => String(x.id) === String(id));
  assert.ok(p, `חבילה ${id} אינה בקטלוג`);
  return p;
};

/** תוויות השורות בטבלה, בסדר שבו הן מרונדרות. */
const rowLabels = (ids) => {
  const html = renderToStaticMarkup(
    React.createElement(CompareSheet, { items: ids.map(byId), onClose: () => {} }),
  );
  return [...html.matchAll(/<th scope="row"[^>]*>([^<]*)</g)].map((m) => m[1]);
};

/*
 * סבב 58, `CompareTray.tsx`. `compareRows` מחזירה את ההסתייגות על
 * המחיר **ראשונה**, ומצהירה במפורש למה: "היא מתייחסת לשורת המחיר
 * שהטבלה מדפיסה מעל השורות האלה (`CompareTray`), ולכן מקומה צמוד
 * אליה". הטבלה דחפה בין השתיים את שורת "אחרי ההטבה" — כלומר ניתקה
 * את ההסתייגות מהמספר שהיא מסייגת, והכוונה המתועדת התקיימה רק בענף
 * החשמל, שבו שורת "אחרי ההטבה" יורדת ממילא.
 */

test("סבב 58: ההסתייגות על המחיר צמודה לשורת המחיר, לפני 'אחרי ההטבה'", () => {
  const labels = rowLabels(["110", "48"]);
  assert.deepEqual(labels.slice(0, 3), ["מחיר לחודש", "תנאי המחיר", "אחרי ההטבה"]);

  // ⚠️ וההסתייגות היא אכן זו של id 110 — המחיר שבשורה הראשונה.
  assert.equal(priceNote(byId("110"))?.label, "תנאי המחיר");
  assert.equal(byId("110").price, 35);
});

test("סבב 58: בחשמל הצמידות שכבר התקיימה לא נשברה", () => {
  const labels = rowLabels(["142", "135"]);
  assert.deepEqual(labels.slice(0, 2), ["שיעור ההנחה", "מה ההנחה כוללת"]);
  assert.equal(labels.includes("אחרי ההטבה"), false, "שורת אחרי-ההטבה חזרה לחשמל");
});

/*
 * ⚠️ ובלי הסתייגות הסדר לא זז: שורת "אחרי ההטבה" ממשיכה לבוא מיד
 * אחרי המחיר. הפיצול נעשה לפי `priceNote` ולא לפי "השורה הראשונה",
 * ולכן טבלה בלי הסתייגות אינה מאבדת שורה ואינה מקבלת אחת.
 */

test("סבב 58: בלי הסתייגות מחיר, הסדר נשאר מחיר → אחרי ההטבה", () => {
  const pair = P.filter((p) => p.category === "cellular" && priceNote(p) == null).slice(0, 2);
  assert.equal(pair.length, 2, "אין בקטלוג שתי חבילות סלולר בלי הסתייגות מחיר");
  const labels = rowLabels(pair.map((p) => String(p.id)));
  assert.deepEqual(labels.slice(0, 2), ["מחיר לחודש", "אחרי ההטבה"]);
});

test("סבב 58: אף שורת עובדה לא נעלמה ולא נכפלה בפיצול", () => {
  for (const ids of [["110", "48"], ["117", "48"], ["142", "135"], ["70", "115"]]) {
    const items = ids.map(byId);
    const expected = compareRows(items).map((r) => r.label);
    const rendered = rowLabels(ids).filter(
      (l) => l !== "מחיר לחודש" && l !== "שיעור ההנחה" && l !== "אחרי ההטבה",
    );
    assert.deepEqual(
      rendered.slice().sort(),
      expected.slice().sort(),
      `${ids.join("+")}: אוסף שורות העובדה זז`,
    );
    assert.equal(new Set(rendered).size, rendered.length, `${ids.join("+")}: שורה נכפלה`);
  }
});
