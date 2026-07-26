import { SEED_EPOCH } from "./seed";

/**
 * דשבורד עסקאות LIVE — ווידג'ט "פעימת שוק" קוסמטי ומדומה.
 *
 * ⚠️ **לא** מחובר ל-`db` ול-`Deal`-ים האמיתיים של הארגון. זהו מודול
 * config סטטי בלבד (באותה רוח כמו `catalog.ts`, אבל עצמאי לגמרי) —
 * המספרים כאן הם דמה, נועדו רק ליצור תחושת "שוק חי" חוצה-ספקים,
 * בדיוק כפי שהמסך האמיתי מציג (ולא מבוסס על עסקאות אמיתיות של
 * המשתמש הזה או הארגון הזה).
 *
 * דטרמיניסטי לגמרי: `rng()` מבוסס-seed (מולברי32, אותה תבנית כמו
 * `seed.ts`), בלי `Math.random()` ובלי `Date.now()` — כדי שרינדור
 * השרת והלקוח יסכימו ולא ייווצרו שגיאות הידרציה.
 */

/** מחולל פסאודו-אקראי דטרמיניסטי (mulberry32) — מראה את זה שב-seed.ts. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface LiveDashboardCompany {
  name: string;
  today: number;
  month: number;
}

export interface LiveDashboardCategory {
  key: string;
  label: string;
  companies: LiveDashboardCompany[];
  today: number;
  month: number;
}

function buildCompanies(seed: number, names: string[]): LiveDashboardCompany[] {
  const r = rng(seed);

  return names.map((name, i) => {
    const cr = rng(seed + i * 977 + 1);
    // כל חברה: 40–300 עסקאות "היום", וחודש-עד-כה שהוא הכפלה
    // מדורגת (~3–5×) — קרוב לפרופורציה שנצפתה במסך האמיתי
    // (יום 20 בחודש, לכן חודש-עד-כה ≈ פי 3.8 מהיום, לא פי 30).
    const today = 40 + Math.floor(cr() * 260 * (0.4 + r() * 0.6));
    const month = Math.round(today * (3 + cr() * 2));
    return { name, today, month };
  });
}

function buildCategory(
  key: string,
  label: string,
  seed: number,
  names: string[],
): LiveDashboardCategory {
  const companies = buildCompanies(seed, names);
  return {
    key,
    label,
    companies,
    today: companies.reduce((sum, c) => sum + c.today, 0),
    month: companies.reduce((sum, c) => sum + c.month, 0),
  };
}

export const LIVE_DASHBOARD_SNAPSHOT: LiveDashboardCategory[] = [
  buildCategory("cellular", "סלולר", 10_007, [
    "גולן טלקום",
    "סלקום",
    "פרטנר",
    "פלאפון",
    "הוט מובייל",
    "וויקום",
  ]),
  buildCategory("internet", "אינטרנט", 20_013, [
    "יס",
    "בזק",
    "פרטנר",
    "הוט",
    "סלקום",
  ]),
  buildCategory("triple", "טריפל / טלוויזיה", 30_019, [
    "יס",
    "סטינג טיוי",
    "נקסט טיוי",
    "הוט",
    "סלקום",
    "פרטנר",
  ]),
];

/**
 * נקודת ייחוס ל"מתי הופק הסנפשוט" — לצורך חותמת רעננות. אותה עוגן
 * זמן קבוע כמו `seed.ts`, לא `Date.now()`.
 */
export const SNAPSHOT_GENERATED_AT = SEED_EPOCH;
