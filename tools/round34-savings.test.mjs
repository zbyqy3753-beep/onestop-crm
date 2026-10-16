import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_LINES,
  computeSaving,
  isComparable,
  priceUnknownAtLines,
  perLinePrice,
} from "../src/app/lp/catalog/savings.ts";
import {
  basePackages,
  isListable,
  packageLabel,
  packageTitle,
  providerName,
  serviceCounts,
} from "../src/app/lp/catalog/catalog.ts";

/*
 * ⚠️ סבב 34. הבדיקות כאן רצות מול **הקטלוג האמיתי** בדיוק מאותו טעם
 * שמתועד בראש `tools/savings.test.mjs`: הכותרת של המחשבון היא הבטחה
 * מספרית לגולש, והסכנה אינה שהקוד ישתנה אלא שהקטלוג יתרענן ויכניס
 * רשומה שמפילה את ההבטחה בשקט.
 */

const PACKAGES = basePackages();

/** הרשומה שכל שערי ה-TV נכתבו סביבה: סטרימינג בלבד עם `hasInternet: true`. */
const STREAMING = PACKAGES.find((p) => p.id === "4");

test("round34: הרשומה שכל שערי ה-TV נכתבו סביבה עדיין בקטלוג", () => {
  assert.ok(STREAMING, "id 4 נעלם מהקטלוג — העדכן את הבדיקות שמתחת");
  assert.equal(STREAMING.category, "home");
  assert.equal(STREAMING.spec.hasInternet, true, "זו הטעות שבנתון המקורי, ולא תיקון");
  assert.equal(STREAMING.spec.hasTv, true);
  assert.equal(STREAMING.type, "TV");
});

test("round34: שער ה-TV הביתי קורא type **וגם** badges", () => {
  /*
   * ⚠️ זה התיקון שדווח בסבב 33 ככשל פתוח: הענף הביתי השווה
   * `p.type !== "TV"` בזמן שהענף הסלולרי קרא `typeText` (type וגם
   * badges). הבדיקה הזו היא השער עליו — `type: null` + `badges`
   * מנורמל הוא הצורה שהמחלץ מייצר לשדה שלא קרא.
   */
  assert.equal(isComparable(STREAMING, "home"), false, "type כמחרוזת — הצורה שבקטלוג היום");
  for (const badges of [["TV"], ["NEXT TV"], ["5G", "TV APP"]]) {
    assert.equal(
      isComparable({ ...STREAMING, type: null, badges }, "home"),
      false,
      `badges=${JSON.stringify(badges)} לא שימש סימן שני על אותה רשומה`,
    );
    const arr = [...PACKAGES.filter((p) => p.id !== "4"), { ...STREAMING, type: null, badges }];
    const saving = computeSaving(arr, "home", 1, 220);
    assert.notEqual(saving.pick?.id, "4", "הסטרימינג חזר להיות החבילה שמולה נמדד טריפל");
    assert.ok(saving.perLine >= 149, `perLine ${saving.perLine} נמוך מהזולה האמיתית בבית`);
  }
});

/*
 * ⚠️ הבדיקה הזו מצהירה על **הכרעה פתוחה**, ולא על שער.
 *
 * `typeText` קורא `badges` רק כשהוא מערך, ולכן `badges: "TV"` — אותה
 * הצהרה בצורה לא מנורמלת — **מאבד** את הסימן ומחזיר את id 4 לבריכת
 * הבית: ₪49 מול חשבון של ₪220 הם כותרת של ₪1,452 בשנה מול שירות
 * סטרימינג. הכיוון ההפוך נוסה ונדחה: הוא פוסל רשומה **בריאה** שהשדה
 * שלה התעוות (`wecom300GB 5G` עם `badges: "כשר"`, ששתי הראיות
 * הקריאות שלה אומרות ההפך) ומקטין את הכותרת בשקט —
 * ו-`tools/savings.test.mjs` מצהיר על ההכרעה הזו במפורש.
 *
 * לכן כאן מתועד מה שקורה היום, עם המחיר הנמדד. כשבעל המערכת יכריע
 * לכיוון השני, הבדיקה הזו תיפול ותדרוש היפוך — וזו המטרה.
 */
test("round34: תיעוד הכרעה — badges שאינו מערך מאבד את סימן ה-TV", () => {
  const mangled = { ...STREAMING, type: null, badges: "TV" };
  assert.equal(
    isComparable(mangled, "home"),
    true,
    "אם זה נפל — ההכרעה על badges פגום התהפכה, והפוך את הבדיקה",
  );
  const arr = [...PACKAGES.filter((p) => p.id !== "4"), mangled];
  const saving = computeSaving(arr, "home", 1, 220);
  assert.equal(saving.pick?.id, "4");
  assert.equal(saving.yearly, 1452, "המחיר המדיד של ההכרעה הזו, בשקלים לשנה");
});

/*
 * ⚠️ המנוע אינו מפיל את רינדור השרת של `/lp`. רשומה שבה שדה אחד פגום
 * זורקת `TypeError` **בתוך** הרינדור ומחזירה את כל הדף ב-500, במקום
 * להפיל חבילה אחת בשקט כמו שכל שער בקובץ עושה. הסריקה כאן היא על כל
 * השדות העליונים ושדות ה-`spec` של כל רשומה × 16 ערכים פגומים × שני
 * מסלולים × שלוש כמויות קווים.
 */
test("round34: אין מסלול התרסקות במנוע על שדה פגום בודד", () => {
  const BAD = [null, undefined, {}, [], "", "x", 0, 1, -1, NaN, true, false, "5", [[]], { length: 2 }, () => 1];
  const fields = new Set();
  const specFields = new Set();
  for (const p of PACKAGES) {
    for (const k of Object.keys(p)) fields.add(k);
    if (p.spec && typeof p.spec === "object") for (const k of Object.keys(p.spec)) specFields.add(k);
  }
  /*
   * ⚠️ השערים עצמם ולא `computeSaving` על כל הקטלוג: שטח ההתרסקות הוא
   * הרשומה הפגומה, וכל שאר הבריכה נבדקת ממילא בבדיקות שמעל. כך
   * הסריקה מכסה את אותם 122,000 שילובים בשניות ולא בדקות.
   */
  const run = (label, pkg) => {
    for (const track of ["cellular", "home"]) {
      assert.doesNotThrow(() => {
        if (isComparable(pkg, track)) {
          for (const lines of [1, 2, MAX_LINES]) {
            priceUnknownAtLines(pkg, lines);
            perLinePrice(pkg, lines);
          }
        }
      }, label);
    }
  };
  for (const p of PACKAGES) {
    for (const f of fields) for (const b of BAD) run(`${p.id}.${f}`, { ...p, [f]: b });
    if (p.spec && typeof p.spec === "object") {
      for (const f of specFields) {
        for (const b of BAD) run(`${p.id}.spec.${f}`, { ...p, spec: { ...p.spec, [f]: b } });
      }
    }
  }
});

/*
 * ⚠️ שתי המחרוזות שהמחשבון שולח ל-CRM, מורכבות כאן **בדיוק** כמו
 * ב-`SavingsCalculator`. `tsx --test` אינו מרנדר את הקומפוננטה, ולכן
 * זו הדרך היחידה להחזיק את השער הזה בבדיקה: שרשור מחרוזות אינו זורק,
 * ולכן `name` פגום אינו מפיל דבר — הליד **נרשם** עם
 * `[object Object] · WeCom` בעמודה הייעודית.
 *
 * ⚠️ `hasReadableName` אינו מכסה את זה: הוא בודק `logicName`
 * (`rawName ?? name`), ושמונה רשומות בקטלוג נושאות `rawName` — על
 * אחת מהן `name` פגום משאיר את השם הלוגי קריא והרשומה עוברת.
 */
test("round34: המחרוזות שנשלחות ל-CRM עוברות דרך packageTitle/packageLabel", () => {
  const withRawName = PACKAGES.filter((p) => p.rawName != null);
  assert.ok(withRawName.length > 0, "אין רשומה עם rawName — הצורה שמחיה את הפער נעלמה");

  const winner = computeSaving(PACKAGES, "cellular", 1, 200).pick;
  assert.ok(winner);
  const crmColumn = (p) => {
    const provider = providerName(p);
    const title = packageTitle(p);
    return title ? `${title} · ${provider}` : provider;
  };
  const repNote = (p) => `מול ${providerName(p)} — ${packageLabel(p, providerName(p))}`;

  // הבחירה הבריאה נשארת כפי שהייתה.
  assert.equal(crmColumn(winner), `${winner.name} · ${providerName(winner)}`);
  assert.equal(repNote(winner), `מול ${providerName(winner)} — ${winner.name}`);

  for (const bad of [{}, null, 5, ["a"], ""]) {
    const m = { ...winner, name: bad, rawName: "wecom300GB 5G" };
    assert.equal(isComparable(m, "cellular"), true, `rawName קריא — ${String(bad)} אמור לעבור`);
    for (const s of [crmColumn(m), repNote(m)]) {
      assert.ok(!s.includes("[object Object]"), `"${s}" דולף [object Object] ל-CRM`);
      assert.ok(!/(?:^|[\s·—])null(?:$|[\s·,])/.test(s), `"${s}" דולף null ל-CRM`);
      assert.ok(!/[—·]\s*(?:,|$)/.test(s), `"${s}" משאיר מפריד בלי מושא`);
    }
    assert.equal(crmColumn(m), providerName(winner), "עמודת CRM נופלת לשם הספק, בלי לכפול אותו");
  }
});

test("round34: הבריכה היא תת-קבוצה של מה שהדף בכלל מציג", () => {
  // ⚠️ חיסכון שנמדד מול חבילה שהדף מסרב להציג הוא מספר שהנציג לא
  // יכול להראות ללקוח. `isComparable` חייבת להיות חזקה מ-`isListable`.
  for (const track of ["cellular", "home"]) {
    for (const p of PACKAGES.filter((q) => isComparable(q, track))) {
      assert.equal(isListable(p), true, `${p.id} בבריכת ${track} אך אינו מוצג בדף`);
    }
  }
});

test("round34: האינווריאנטים של Saving על כל המסלולים והכמויות", () => {
  for (const track of ["cellular", "home"]) {
    for (let lines = 1; lines <= MAX_LINES; lines += 1) {
      for (const spend of [10, 34, 149, 220, 220.5, 512.8, 1200, 5000]) {
        const s = computeSaving(PACKAGES, track, lines, spend);
        assert.equal(s.lines, lines, "הגידור חייב להחזיר את הכמות שנמסרה בטווח 1..MAX_LINES");
        assert.equal(s.yearly, s.monthly * 12, "שתי השורות על המסך חייבות להסתדר");
        assert.ok(Number.isFinite(s.monthly) && Number.isFinite(s.yearly));
        if (s.pick) {
          assert.equal(s.perLine, perLinePrice(s.pick, s.lines), "המסך גוזר את המחיר מהמנוע");
          assert.ok(s.perLine > 0);
        }
        if (s.worthwhile) {
          assert.ok(s.monthly > 0 && s.monthly < spend, `חיסכון ${s.monthly} מול חשבון ${spend}`);
        }
      }
    }
  }
});

/*
 * ⚠️ הבדיקה הזו **הופכה** בסבב 34: היא תיעדה פער, והפער נסגר.
 *
 * `serviceCounts` שאלה `p.type !== "TV"` בזמן שהמחשבון שאל `typeText`
 * (type **וגם** badges), ולכן רשומה עם `type: null` ו-`badges: ["TV"]`
 * נספרה כאינטרנט ברצועת השירותים ונפסלה כטלוויזיה במחשבון — שתי
 * אמירות סותרות על אותה רשומה באותו עמוד. `typeText` אוחד ל-`catalog.ts`
 * ו-`serviceCounts` קורא אותו עכשיו. הנעילה היא בשני הכיוונים בכוונה:
 * אותה רשומה חייבת להיות מוחרגת **גם** מהמונה **וגם** מהבריכה.
 */
test("round34: serviceCounts והמחשבון מסכימים על רשומת TV שה-type שלה ריק", () => {
  const arr = [...PACKAGES.filter((p) => p.id !== "4"), { ...STREAMING, type: null, badges: ["TV"] }];
  const before = serviceCounts(PACKAGES);
  const after = serviceCounts(arr);
  assert.equal(
    after.internet,
    before.internet,
    "רשומה שהמחשבון פוסל כטלוויזיה לא נספרת כאינטרנט",
  );
  assert.equal(computeSaving(arr, "home", 1, 220).pick?.id !== "4", true);
});
