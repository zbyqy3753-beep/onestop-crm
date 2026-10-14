import assert from "node:assert/strict";
import { test } from "node:test";

import {
  basePackages,
  byCategory,
  catalog,
  cheapest,
  disclosedRiseCount,
  highlights,
  listable,
  listableCounts,
  providers,
  serviceCounts,
} from "../src/app/lp/catalog/catalog.ts";
import { promoRise } from "../src/app/lp/catalog/format.ts";

/*
 * ⚠️ המחלקה שכל הבדיקות כאן שייכות לה: הקטלוג נכנס לקוד דרך
 * `as unknown as Catalog`, כלומר **אין ולידציה בזמן ריצה**. השערים
 * ב-`catalog.ts` נכתבו רשומה-רשומה, והדפוס שחוזר שוב ושוב הוא **שער
 * שחובר למשטח אחד ולא לאח שלו**. שלוש הבדיקות כאן תופסות שלושה אחים
 * כאלה שנשארו פתוחים, וכל אחת מהן גם מקבעת את המספר של **היום** כדי
 * שהשער לא יהיה "לא סופרים כלום".
 *
 * ⚠️ הבדיקות דוחפות רשומה סינתטית ל-`catalog` עצמו (ו-`pop` ב-`finally`),
 * כי זה המקום היחיד שבו `basePackages()` קוראת — בדיוק כמו הבדיקות
 * המקבילות ב-`catalog.test.mjs`.
 */

const PACKAGES = basePackages();

/*
 * ⚠️ שרשרת הקריאות של `page.tsx`, בסדר שבו היא רצה. אי אפשר לייבא כאן
 * את הדף עצמו (`CatalogBrowser` בשרשרת שלו מחזיק `await` ברמת המודול),
 * ולכן המחלקה נתפסת דרך כל הפונקציות שהרינדור קורא — כולן, ולא
 * קובץ-קובץ: רשומה פגומה אחת הפילה בעבר את **הדף כולו** ולא חבילה אחת.
 */
const renderChain = (rows) => {
  const shown = listable(rows);
  return {
    services: serviceCounts(shown),
    counts: listableCounts(shown),
    providers: providers(shown).map((p) => `${p.slug}:${p.count}`),
    lead: cheapest(byCategory(shown, "cellular"), 1)[0]?.id ?? null,
    highlights: ["cellular", "home", "electricity"].map((c) =>
      highlights(shown, c, 3).map((p) => p.id).join("+"),
    ),
    disclosed: disclosedRiseCount(shown),
  };
};

test("קטלוג: רשומה שאינה אובייקט נופלת לבד ואינה מפילה את הדף", () => {
  const base = renderChain(PACKAGES);

  /*
   * ⚠️ `null` הוא הצורה שמחלץ JSON מייצר לרשומה שלא נקראה, והוא זרק
   * `TypeError` על `.name` בשורה הראשונה של `page.tsx` (`basePackages`)
   * — לפני הירו, לפני המונים ולפני כל שער אחר. האח שלו, מערך הספקים,
   * גודר מזמן.
   */
  for (const broken of [null, undefined, "חבילה", 7, true]) {
    catalog.packages.push(broken);
    try {
      const rebuilt = basePackages();
      assert.equal(
        rebuilt.length,
        catalog.packages.length - 1,
        `רשומה ${JSON.stringify(broken)} לא נפלה ב-basePackages`,
      );
      assert.deepEqual(
        renderChain(rebuilt),
        base,
        `רשומה ${JSON.stringify(broken)} הזיזה את הדף`,
      );
    } finally {
      catalog.packages.pop();
    }
  }

  // ומערך שלם של רשומות פגומות — אף אחת מהן אינה מגיעה לדף.
  catalog.packages.push(null, undefined, []);
  try {
    assert.equal(basePackages().length, catalog.packages.length - 3);
    assert.deepEqual(renderChain(basePackages()), base);
  } finally {
    catalog.packages.length = catalog.packages.length - 3;
  }

  // ו-109 הרשומות של היום, כולן שמישות.
  assert.equal(PACKAGES.length, 109);
});

test("ספקים: שם ולוגו פגומים ברשימת הקטלוג אינם מצטטים 'null' ברצועה", () => {
  const base = providers(PACKAGES);
  const target = base[0];
  const real = catalog.providers.find((p) => p.slug === target.slug);
  const index = catalog.providers.indexOf(real);

  /*
   * ⚠️ הרצועה בהירו מדפיסה `title={`חבילות ${p.name}`}`, ולכן
   * `name: null` ברשומת הקטלוג צייר "חבילות null" — בדיוק מה
   * ש-`providerName` נכתב למנוע על ה-`ProviderRef` של החבילה.
   */
  for (const broken of [null, "", 7, {}]) {
    catalog.providers[index] = { ...real, name: broken, logo: broken };
    try {
      const row = providers(PACKAGES).find((p) => p.slug === target.slug);
      assert.equal(typeof row.name, "string", `name=${JSON.stringify(broken)} אינו מחרוזת`);
      assert.ok(row.name, `name=${JSON.stringify(broken)} החזיר שם ריק`);
      assert.ok(!/^(null|undefined|7|\[object)/.test(row.name), `שם מצוטט: ${row.name}`);
      assert.equal(typeof row.logo, "string");
      assert.equal(row.count, target.count, "המונה זז");
    } finally {
      catalog.providers[index] = real;
    }
  }

  // ושם תקין אינו נדרס בנפילה חזרה.
  assert.deepEqual(
    providers(PACKAGES).map((p) => `${p.slug}:${p.name}:${p.logo}`),
    base.map((p) => `${p.slug}:${p.name}:${p.logo}`),
  );
});

test("אמון: מונה הגילויים אינו סופר הערה שאף כרטיס לא ידפיס", () => {
  const base = disclosedRiseCount(PACKAGES);
  const silent = PACKAGES.find(
    (p) =>
      p.category === "cellular" &&
      p.price > 0 &&
      p.priceAfterPromo == null &&
      p.priceAfterPromoNote == null,
  );

  /*
   * ⚠️ `promoRise` ב-`format.ts` הוא המשטח היחיד שמדפיס את השדה, והוא
   * דורש מחרוזת לא ריקה. `disclosedRiseCount` שאלה `!= null`, ולכן כל
   * אחד מהערכים כאן הגדיל את "נתון האמון" של הדף בזמן שאין מאחוריו
   * שורה אחת על אף כרטיס.
   */
  for (const note of ["", 0, {}, 5, true, []]) {
    const row = { ...silent, id: "test-note", priceAfterPromoNote: note };
    assert.equal(promoRise(row), null, `promoRise הדפיס ${JSON.stringify(note)}`);
    assert.equal(
      disclosedRiseCount([...PACKAGES, row]),
      base,
      `note=${JSON.stringify(note)} ניפח את מונה הגילויים`,
    );
  }

  // והצהרה אמיתית — מספרית או מילולית — כן נספרת.
  for (const row of [
    { ...silent, id: "test-num", priceAfterPromo: 59.9 },
    { ...silent, id: "test-prose", priceAfterPromoNote: "לאחר שנה 59 ₪ לחודש" },
  ]) {
    assert.ok(promoRise(row), `promoRise לא הדפיס את ${row.id}`);
    assert.equal(disclosedRiseCount([...PACKAGES, row]), base + 1, row.id);
  }

  // ומספר הגילויים של היום.
  assert.equal(base, 34);
});
