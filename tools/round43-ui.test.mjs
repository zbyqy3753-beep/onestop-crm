import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  CATEGORY_ORDER,
  basePackages,
  byCategory,
  listable,
  providerSlug,
  providers,
} from "../src/app/lp/catalog/catalog.ts";

/*
 * ⚠️ סבב 43, שני ממצאים במשטח:
 *
 *   • `CompareTray` הניח שהוא **יחיד** בדף. `CatalogTabs` מרנדר
 *     אותו פעם אחת, אבל `provider/[slug]/page.tsx` מרנדר
 *     `CatalogBrowser` אחד לכל קטגוריה — ולכן ה-class הגלובלי
 *     `lp-tray-open` ירד בזמן שמגש אחר עוד על המסך.
 *   • ההסתייגות על קו הטלפון הוצמדה ל-`hasPhone !== true`, שהוא
 *     אינו "הקו כלול בלי עלות". ראה `round43-savings`.
 *
 * ⚠️ אפקטים של React אינם רצים ב-`renderToStaticMarkup`, ולכן
 * מונה-ההתייחסויות עצמו נבדק במקור. ההנחה שמתחתיו — ריבוי
 * המופעים — כן נמדדת מול הקטלוג האמיתי.
 */

const live = listable(basePackages());
const src = (p) => readFileSync(new URL(`../src/app/lp/${p}`, import.meta.url), "utf8");

test("סבב 43: יש עמודי ספק שמרנדרים יותר ממגש אחד", () => {
  const multi = providers(live)
    .map((c) => {
      const own = live.filter((p) => providerSlug(p) === c.slug);
      return [c.slug, CATEGORY_ORDER.filter((k) => byCategory(own, k).length > 0).length];
    })
    .filter(([, n]) => n > 1);
  // ⚠️ אם הרשימה מתרוקנת ברענון, ההנחה מתחת לתיקון נעלמה — אבל
  // המונה נשאר נכון גם אז.
  assert.deepEqual(multi, [
    ["cellcom", 3],
    ["partner", 2],
  ]);
});

test("סבב 43: CatalogBrowser מרנדר מגש לכל מופע", () => {
  assert.match(src("ui/CatalogBrowser.tsx"), /<CompareTray\s/);
  assert.match(src("provider/[slug]/page.tsx"), /sections\.map\(/);
});

test("סבב 43: lp-tray-open מנוהל במונה ולא בדגל", () => {
  const tray = src("ui/CompareTray.tsx");
  assert.match(tray, /let openTrays = 0;/);
  assert.match(tray, /openTrays \+= 1;/);
  assert.match(tray, /openTrays -= 1;/);
  // ⚠️ ההסרה **מותנית** במונה: זה כל התיקון.
  assert.match(tray, /if \(openTrays <= 0\) \{[\s\S]{0,120}?classList\.remove\("lp-tray-open"\)/);
  // ואין הסרה בלתי-מותנית שנשארה מאחור.
  assert.equal(
    tray.split("\n").filter((l) => /classList\.remove\("lp-tray-open"\)/.test(l)).length,
    1,
  );
});

test("סבב 43: ההסתייגות על קו הטלפון קוראת גם את הצהרת התוספת", () => {
  const calc = src("ui/SavingsCalculator.tsx");
  assert.match(calc, /phoneLineCostsExtra,/);
  /*
   * ⚠️ הניסוח השתנה בסבב 45, הדרישה לא. שתי הזרועות שהמבחן הזה
   * קיבע (`hasPhone !== true` **או** `phoneLineCostsExtra`) חיו
   * בתוך ה-JSX — ובמשטח השני, ההערה לנציג, היה תנאי **צר** מהן.
   * לכן הן חולצו לנגזרת אחת שגם המסך וגם ההערה קוראים, וזו הצורה
   * שמקובעת כאן: אותן שתי זרועות, במקום אחד.
   */
  assert.match(calc, /const phoneMissing =[\s\S]{0,120}?hasPhone !== true/);
  assert.match(calc, /const phoneExtra =[\s\S]{0,80}?phoneLineCostsExtra\(saving\.pick\)/);
  assert.match(calc, /const phoneDisclosure =[\s\S]{0,120}?phoneMissing \|\| phoneExtra/);
});
