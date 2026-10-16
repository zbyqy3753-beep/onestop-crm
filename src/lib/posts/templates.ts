import type { StudioPackage } from "./catalog";

/**
 * תבניות הפוסטים של "אלירן תקשורת". כל תבנית מקבלת נתונים ומחזירה רצף
 * שקפים (מבנה בלבד, בלי ציור) וכיתוב. הציור עצמו ב-`renderSlide`.
 *
 * ⚠️ שלושה סוגי שקפים בלבד, כולם לפי הפוסטר המאושר של אלירן (הסקיל
 * `eliran-tikshoret-design`): פתיח עם איור הטלפון, כרטיס עם פיל, וסיום עם
 * כרטיס יצירת הקשר ושורת הלוגואים. תבנית חדשה מרכיבה אותם ולא ממציאה סוג.
 *
 * ⚠️ אין כאן שום מספר שלא הגיע מהקטלוג או מהמשתמש. שפת המותג אוסרת
 * "חיסכון של X ₪" בלי נתון אמיתי, וזה נאכף כאן ולא בעין.
 */

export const BRAND = {
  name: "אלירן קליין",
  title: "יועץ תקשורת",
  tagline: "ייעוץ תקשורת סלולרית וביתית",
  phone: "052-6811145",
  handle: "@telecom4you",
} as const;

export type Tone = "navy" | "blue" | "red";

export interface Row {
  label: string;
  sub?: string;
  /** "לפני", מוצג מימין לחץ. בלי `from` מוצג רק `value`. */
  from?: string;
  value: string;
  tone?: Tone;
}

export interface Title {
  text: string;
  /** מילה או צירוף מתוך `text` שמקבלים מרקר צהוב. */
  mark?: string;
  /** שורה נוספת בבלוק כחול עם טקסט לבן, מתחת לכותרת. */
  block?: string;
}

export type Slide =
  | {
      kind: "hook";
      kicker?: string;
      title: Title;
      sub?: string;
      /** חלק מ-`sub` שמקבל קו תחתון צהוב. */
      underline?: string;
    }
  | {
      kind: "card";
      number?: string;
      title: Title;
      sub?: string;
      pill: string;
      /** תגית צהובה בתוך הפיל ("בחינם", "חשוב"). */
      tag?: string;
      rows?: Row[];
      checks?: string[];
      imp?: { title: string; text: string };
      note?: string;
    }
  | { kind: "cta"; title: Title; intro: string };

export interface Post {
  slides: Slide[];
  caption: string;
}

export const TEMPLATES = {
  afterPromo: {
    label: "המחיר אחרי המבצע",
    hint: "2–4 חבילות סלולר, עם המחיר שלהן לפני ואחרי תום ההטבה",
  },
  spotlight: {
    label: "חבילה בפוקוס",
    hint: "חבילה אחת מהקטלוג, עם המחיר והמפרט שלה",
  },
  compare: {
    label: "השוואת חבילות",
    hint: "2–4 חבילות מאותה קטגוריה, מהזולה ליקרה",
  },
  tip: {
    label: "טיפ חופשי",
    hint: "כותרת ונקודות שאתה כותב בעצמך",
  },
} as const;

export type TemplateId = keyof typeof TEMPLATES;

const SOURCE_NOTE =
  "לפי קטלוג החבילות באתר. המחירים עשויים להשתנות, והתנאים המחייבים הם של החברה.";

const FREE = { title: "הבדיקה אצלי ללא עלות", text: "אין התחייבות אליי ואין התחייבות לחברות התקשורת." };

export const shekel = (n: number) =>
  `₪${Number.isInteger(n) ? n : n.toFixed(n * 10 === Math.round(n * 10) ? 1 : 2)}`;

const CATEGORY_HE: Record<StudioPackage["category"], string> = {
  cellular: "סלולר",
  home: "אינטרנט וטלוויזיה",
  electricity: "חשמל",
};

const HASHTAGS: Record<StudioPackage["category"], string> = {
  cellular: "#חבילתסלולר #סלולר #חיסכון #צרכנות",
  home: "#אינטרנטסיבים #סיבים #חיסכון #צרכנות",
  electricity: "#חשמל #הנחהבחשמל #חיסכון #צרכנות",
};

const WHATSAPP_LINE = `שלחו לי צילום של החשבון לוואטסאפ ${BRAND.phone}, ואבדוק בלי עלות.`;

function cta(title: string, block: string, ask: string): Slide {
  return {
    kind: "cta",
    title: { text: title, block },
    intro: `אני אלירן, ${BRAND.tagline.replace("ייעוץ", "יועץ")}. ${ask}`,
  };
}

/* ── המחיר אחרי המבצע ─────────────────────────────────────────────── */

export function afterPromoPost(picked: StudioPackage[]): Post {
  const rows = picked.filter((p) => p.price != null && p.after != null);
  if (rows.length === 0) throw new Error("בחר לפחות חבילה אחת עם מחיר אחרי ההטבה.");
  const lead = [...rows].sort((a, b) => b.after! - b.price! - (a.after! - a.price!))[0];
  const price = shekel(lead.price!);
  const after = shekel(lead.after!);

  return {
    slides: [
      {
        kind: "hook",
        kicker: "לפני שמחליפים חבילת סלולר,",
        title: { text: `${price} בחודש הראשון.`, mark: price, block: `ואחר כך? ${after}` },
        sub: "את המספר השני כמעט אף אחד לא מראה לכם.",
        underline: "כמעט אף אחד לא מראה לכם.",
      },
      {
        kind: "card",
        title: { text: "כמה עולה החבילה כשהמבצע נגמר", mark: "כשהמבצע נגמר" },
        pill: "דוגמאות אמיתיות",
        tag: `${rows.length}`,
        rows: rows.map((p) => ({
          label: p.provider,
          sub: p.stat ?? p.name,
          from: shekel(p.price!),
          value: shekel(p.after!),
          tone: "red" as const,
        })),
        note: `מחיר לחודש, לקו. ${SOURCE_NOTE}`,
      },
      {
        kind: "card",
        title: { text: "3 שאלות לשאול את הנציג לפני שמסכימים", mark: "3 שאלות" },
        pill: "שמרו את זה",
        tag: "חשוב",
        checks: [
          "מה המחיר אחרי שההטבה נגמרת?",
          "באיזה חודש בדיוק היא נגמרת?",
          "כמה זה עולה לכל הקווים ביחד?",
        ],
        imp: FREE,
      },
      cta(
        "רוצים לדעת כמה תשלמו?",
        "אבדוק לכם את החשבון",
        "שלחו לי צילום של החשבון, ואבדוק מתי ההטבה שלכם נגמרת ואם יש חבילה זולה יותר.",
      ),
    ],
    caption: [
      `${price} בחודש הראשון. ${after} כשההטבה נגמרת. אותה חבילה בדיוק.`,
      "",
      "ככה נראות הרבה מהחבילות הזולות: מחיר מבצע שנגמר בשקט, בלי שאף אחד מתקשר להגיד.",
      `בקרוסלה יש ${rows.length > 1 ? `${rows.length} דוגמאות אמיתיות` : "דוגמה אמיתית"} ו-3 שאלות לשאול את הנציג לפני שמסכימים.`,
      "",
      `רוצים לדעת מתי ההטבה שלכם נגמרת? ${WHATSAPP_LINE}`,
      "",
      HASHTAGS.cellular,
    ].join("\n"),
  };
}

/* ── חבילה בפוקוס ─────────────────────────────────────────────────── */

/**
 * המספר הגדול שבשקף הפתיח — עם ההסתייגויות שהרשומה עצמה מסרה עליו.
 *
 * ⚠️ `discountIsCapped` ו-`discountScope` חוברו לכרטיס וללוח ההשוואה
 * ב-`/lp` ולא למשטח הזה, ולכן ids 135 ו-142 הדפיסו "10% הנחה" שטוח
 * כשהרשומה אומרת "**עד** 10%" (הנחה מדורגת לפי גובה החשבון), ו-10
 * מסלולי החשמל (134, 135, 136, 137, 140, 142, 146, 147, 149, 150)
 * הדפיסו "20% הנחה" בלי אות אחת מההצהרה שההנחה חלה על **רכיב**
 * בחשבון ולא על החשבון. בפוסט זה גרוע מבאתר: המספר מתפרסם בשם של
 * אלירן.
 *
 * ⚠️ מוחזר נוסח הרשומה ובלי מקדם לחלקו של הרכיב בחשבון, כמו
 * ב-`discountScope`: המקדם אינו בקטלוג וכל ניחוש היה הופך את
 * ההסתייגות למספר שנראה מחושב.
 */
export function headlineText(p: StudioPackage): string {
  if (p.category !== "electricity") return `${shekel(p.price!)} לחודש`;
  const pct = `${p.discountIsCapped ? "עד " : ""}${p.discountPercent}% הנחה`;
  return p.discountScope ? `${pct} על ${p.discountScope}` : pct;
}

/**
 * השורה שמתחת לכותרת. ההסתייגות על המחיר נאמרת כאן, ולא נשארת
 * לכרטיס פנימי: שקף הפתיח הוא ההצהרה שנראית ראשונה ולבדה.
 */
function hookSub(p: StudioPackage): string {
  const tail = "כדאי לדעת מה באמת כלול.";
  return p.priceNote ? `${p.priceNote}. ${tail}` : `לפני שמצטרפים, ${tail}`;
}

/*
 * ⚠️ 22 תווים, ולא אורך הנוסח. `row.value` מצויר ב-`fillText` יחיד
 * ב-`renderSlide.ts:464` — בלי `wrap` ובלי קיצור — בגופן 42 bold מול
 * תווית שמצוירת מימין באותה שורה, כלומר נוסח ארוך היה **נדרס** על
 * התווית ויוצא מהכרטיס. לכן השקף מקבל את העובדה ("יש תקופת מבצע")
 * והכיתוב — שהוא טקסט ולא ציור — מקבל את הנוסח **כמות שהוא**. ids 42
 * ("אחרי שנתיים 69.9") ו-83 נכנסים; ids 23, 58, 61, 81, 92, 108, 109,
 * 132 ארוכים מזה.
 */
const PROMO_PERIOD_ROW = "יש תקופת מבצע";
const ROW_VALUE_MAX = 22;

/**
 * מה שהרשומה מסרה על התקופה שאחרי ההטבה — מספר, נוסח, או עצם קיומה.
 *
 * ⚠️ הענף האמצעי מדפיס את **נוסח הרשומה** ולא ניסוח שלנו, והענף
 * השלישי אינו אומר שהמחיר עולה. ראה `afterRises` ו-`promoPeriod`
 * ב-`catalog.ts`: ב-8 מ-11 הנוסחים ה-`price` הוא כבר מחיר הקבע,
 * ובשלושה מהם המחיר שאחרי אף **נמוך** ממנו.
 */
function afterRow(p: StudioPackage): Row | null {
  const label = "אחרי תום ההטבה";
  if (p.after != null) return { label, from: shekel(p.price!), value: shekel(p.after), tone: "red" };
  if (p.afterNote) {
    const fits = p.afterNote.length <= ROW_VALUE_MAX;
    return {
      label,
      value: fits ? p.afterNote : PROMO_PERIOD_ROW,
      tone: p.afterRises ? "red" : undefined,
    };
  }
  if (p.promoPeriod) return { label, value: PROMO_PERIOD_ROW };
  return null;
}

/**
 * שורת הכיתוב על התקופה שאחרי ההטבה.
 *
 * ⚠️ "המחיר עולה" ייאמר רק כשיש מספר אמין (`after`) או כששער הכיוון
 * `afterRises` דלוק. בלעדיו מודפס נוסח הרשומה בתוך מרכאות, כי הנוסח
 * עצמו נושא את הכיוון — ואנחנו לא.
 *
 * ⚠️ ברירת המחדל הקודמת ("כדאי לבדוק מה קורה למחיר כשההטבה נגמרת")
 * נשארת רק לרשומה ש**לא אמרה דבר**. היא הודפסה על 30 רשומות שכן
 * אמרו, כלומר הכחישה את ההצהרה של הרשומה עצמה.
 */
function afterCaption(p: StudioPackage): string {
  if (p.category === "electricity") {
    /*
     * ⚠️ "מה קורה למחיר כשההטבה נגמרת" נאמר כאן על מסלול הנחה שאין לו
     * מחיר חודשי ואין לו תום הטבה — `promoRise` מחזירה `null` לחשמל
     * במפורש. ההסתייגות שכן קיימת היא מה שההנחה חלה עליו.
     */
    if (p.discountScope) {
      return `שימו לב: ההנחה חלה על ${p.discountScope} בחשבון בלבד, ולא על החשבון כולו.`;
    }
    return p.discountIsCapped
      ? "שימו לב: זו תקרת הנחה ולא שיעור אחיד — בדקו איזו הנחה מגיעה לחשבון שלכם."
      : "לפני שמצטרפים, כדאי לבדוק על מה בדיוק ההנחה חלה.";
  }
  if (p.after != null) {
    return `שימו לב: אחרי תום ההטבה המחיר עולה ל-${shekel(p.after)}. את זה כדאי לדעת לפני שמצטרפים.`;
  }
  if (p.afterNote) {
    const head = p.afterRises ? "שימו לב: אחרי תום ההטבה המחיר עולה" : "מה שהחבילה אומרת על התקופה שאחרי ההטבה";
    return `${head} — "${p.afterNote}". את זה כדאי לדעת לפני שמצטרפים.`;
  }
  if (p.promoPeriod) {
    return "שימו לב: החבילה מצהירה על תקופת מבצע. בדקו מה המחיר אחריה לפני שמצטרפים.";
  }
  return "לפני שמצטרפים, כדאי לבדוק מה קורה למחיר כשההטבה נגמרת.";
}

export function spotlightPost(p: StudioPackage): Post {
  const isElec = p.category === "electricity";
  const priceText = headlineText(p);
  const rows: Row[] = [];
  if (p.stat) rows.push({ label: isElec ? "שעות ההנחה" : "מה כלול", value: p.stat });
  const after = afterRow(p);
  if (after) rows.push(after);
  if (p.installation != null) {
    rows.push({ label: "התקנה", value: p.installation === 0 ? "ללא עלות" : shekel(p.installation) });
  }

  return {
    slides: [
      {
        kind: "hook",
        kicker: `${CATEGORY_HE[p.category]} · ${p.provider}`,
        title: { text: p.name, block: priceText },
        sub: hookSub(p),
        underline: "מה באמת כלול.",
      },
      ...(rows.length
        ? [
            {
              kind: "card" as const,
              title: { text: "מה יש בחבילה", mark: "בחבילה" },
              pill: p.provider,
              rows,
              note: SOURCE_NOTE,
            },
          ]
        : []),
      cta(
        "רוצים לבדוק אם זה משתלם?",
        "אשווה בשבילכם",
        "שלחו לי צילום של החשבון, ואשווה אותו מול החבילה הזו ומול כל החברות.",
      ),
    ],
    caption: [
      `${p.provider}: ${p.name}, ${priceText}.`,
      "",
      afterCaption(p),
      "",
      `רוצים לדעת אם זה משתלם לכם? ${WHATSAPP_LINE}`,
      "",
      HASHTAGS[p.category],
    ].join("\n"),
  };
}

/* ── השוואת חבילות ────────────────────────────────────────────────── */

/** שורת המשנה בטבלת ההשוואה: קצרה, ובלי לטעון כיוון שלא הוכח. */
export function compareAfter(p: StudioPackage): string | null {
  if (p.after != null) return `אחר כך ${shekel(p.after)}`;
  if (p.afterNote || p.promoPeriod) return "יש תקופת מבצע";
  return null;
}

function compareScope(p: StudioPackage): string | null {
  return p.discountScope ? `על ${p.discountScope}` : null;
}

export function comparePost(picked: StudioPackage[]): Post {
  if (picked.length < 2) throw new Error("בחר לפחות שתי חבילות להשוואה.");
  const category = picked[0].category;
  if (picked.some((p) => p.category !== category)) {
    throw new Error("כל החבילות בהשוואה צריכות להיות מאותה קטגוריה.");
  }
  const isElec = category === "electricity";
  const sorted = [...picked].sort((a, b) =>
    isElec ? (b.discountPercent ?? 0) - (a.discountPercent ?? 0) : a.price! - b.price!,
  );

  return {
    slides: [
      {
        kind: "hook",
        kicker: `השוואת ${CATEGORY_HE[category]},`,
        title: { text: `${sorted.length} חבילות, אותה שאלה:`, mark: "אותה שאלה", block: "מה באמת משתלם?" },
        sub: "השוויתי בשבילכם מחיר, מפרט ומה קורה כשההטבה נגמרת.",
        underline: "מה קורה כשההטבה נגמרת.",
      },
      {
        kind: "card",
        title: { text: isElec ? "ההנחה בכל מסלול" : "המחיר של כל חבילה", mark: isElec ? "ההנחה" : "המחיר" },
        pill: "ההשוואה",
        tag: isElec ? "מהגבוהה" : "מהזולה",
        /*
         * ⚠️ אותם שערים של שקף הפוקוס, באותה טבלה שכל תפקידה להשוות
         * מספרים: בלעדיהם "10%" של ids 135/142 ישב ליד "20%" של id 150
         * כאילו שניהם שיעור אחיד על החשבון, כששתי ההצהרות שונות גם
         * בתקרה וגם במה שההנחה חלה עליו. ו-"אחר כך X" הופיע רק לרשומה
         * עם מספר, כלומר רשומה שהצהירה בפרוזה נראתה כמי שלא הצהירה.
         */
        rows: sorted.map((p) => ({
          label: p.provider,
          sub: [p.stat, isElec ? compareScope(p) : compareAfter(p)].filter(Boolean).join(" · "),
          value: isElec ? `${p.discountIsCapped ? "עד " : ""}${p.discountPercent}%` : shekel(p.price!),
          tone: "blue" as const,
        })),
        note: `${isElec ? "אחוז ההנחה כפי שהרשומה מצהירה עליו." : "מחיר לחודש."} ${SOURCE_NOTE}`,
      },
      cta(
        "לא בטוחים מה מתאים לכם?",
        "אבדוק לכם את החשבון",
        "שלחו לי צילום של החשבון, ואגיד לכם איזו חבילה הכי משתלמת לשימוש שלכם.",
      ),
    ],
    caption: [
      `השוויתי ${sorted.length} חבילות ${CATEGORY_HE[category]}, ${isElec ? "מההנחה הגבוהה לנמוכה" : "מהזולה ליקרה"}.`,
      "",
      isElec
        ? "האחוז בכותרת הוא רק חלק מהסיפור: כדאי לבדוק על מה ההנחה חלה ואם יש לה תקרה."
        : "המחיר בכותרת הוא רק חלק מהסיפור: כדאי לבדוק גם את המפרט ומה קורה כשההטבה נגמרת.",
      "",
      `לא בטוחים מה מתאים לכם? ${WHATSAPP_LINE}`,
      "",
      HASHTAGS[category],
    ].join("\n"),
  };
}

/* ── טיפ חופשי ────────────────────────────────────────────────────── */

export function tipPost(input: { title: string; points: string[]; mark?: string }): Post {
  const title = input.title.trim();
  const points = input.points.map((s) => s.trim()).filter(Boolean).slice(0, 5);
  if (!title) throw new Error("כתוב כותרת לטיפ.");
  if (points.length === 0) throw new Error("כתוב לפחות נקודה אחת.");
  const mark = input.mark?.trim();
  if (mark && !title.includes(mark)) throw new Error("המילה להדגשה חייבת להופיע בכותרת בדיוק כך.");

  return {
    slides: [
      {
        kind: "card",
        title: { text: title, mark: mark || undefined },
        pill: "טיפ מאלירן",
        checks: points,
        imp: FREE,
      },
      cta("רוצים שאבדוק לכם?", "ייעוץ ללא עלות", "שלחו לי צילום של החשבון, ואעשה לכם סדר בלי התחייבות."),
    ],
    caption: [title, "", ...points.map((p) => `✔️ ${p}`), "", WHATSAPP_LINE, "", "#חיסכון #צרכנות #סלולר #אינטרנט"].join(
      "\n",
    ),
  };
}
