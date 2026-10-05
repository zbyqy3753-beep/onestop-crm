import type { StudioPackage } from "./catalog";

/**
 * תבניות הפוסטים של "אלירן תקשורת": כל תבנית מקבלת נתונים ומחזירה
 * רצף שקפים (כבלוקים, בלי ציור) וכיתוב. הציור עצמו ב-`renderSlide`.
 *
 * ⚠️ אין כאן שום מספר שלא הגיע מהקטלוג או מהמשתמש. השפה של המותג
 * אוסרת "חיסכון של X ₪" בלי נתון אמיתי, וזה נאכף כאן ולא בעין.
 */

export const BRAND = {
  name: "אלירן קליין",
  title: "יועץ תקשורת",
  phone: "052-6811145",
  handle: "@telecom4you",
  site: "onestop-crm.vercel.app/lp",
} as const;

export type Tone = "navy" | "blue" | "red" | "green";

export type Block =
  | { t: "title"; text: string; mark?: string }
  | { t: "big"; text: string; tone: Tone }
  | { t: "body"; text: string; strong?: boolean }
  | { t: "rows"; rows: { label: string; sub?: string; value: string; tone?: Tone }[] }
  | { t: "checks"; items: string[] }
  | { t: "note"; text: string }
  | { t: "cta"; headline: string; body: string };

export interface Slide {
  tag?: string;
  blocks: Block[];
}

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

export const shekel = (n: number) =>
  `₪${Number.isInteger(n) ? n : n.toFixed(n * 10 === Math.round(n * 10) ? 1 : 2)}`;

const CATEGORY_HE: Record<StudioPackage["category"], string> = {
  cellular: "סלולר",
  home: "אינטרנט וטלוויזיה",
  electricity: "חשמל",
};

function ctaSlide(headline: string, body: string): Slide {
  return {
    tag: "ייעוץ ללא עלות",
    blocks: [
      { t: "title", text: headline },
      { t: "body", text: body },
      {
        t: "cta",
        headline: "מעדיפים להשוות לבד?",
        body: "באתר ההשוואה יש את החבילות של החברות הגדולות, במקום אחד. הקישור בביו.",
      },
    ],
  };
}

const HASHTAGS: Record<StudioPackage["category"], string> = {
  cellular: "#חבילתסלולר #סלולר #חיסכון #צרכנות",
  home: "#אינטרנטסיבים #סיבים #חיסכון #צרכנות",
  electricity: "#חשמל #הנחהבחשמל #חיסכון #צרכנות",
};

const WHATSAPP_LINE = `שלחו לי צילום של החשבונית לוואטסאפ ${BRAND.phone}, ואבדוק בלי עלות.`;

/* ── המחיר אחרי המבצע ─────────────────────────────────────────────── */

export function afterPromoPost(picked: StudioPackage[]): Post {
  const rows = picked.filter((p) => p.price != null && p.after != null);
  if (rows.length === 0) throw new Error("בחר לפחות חבילה אחת עם מחיר אחרי ההטבה.");
  const lead = [...rows].sort((a, b) => b.after! - b.price! - (a.after! - a.price!))[0];

  return {
    slides: [
      {
        tag: "לפני שמחליפים חבילה",
        blocks: [
          { t: "title", text: "המחיר במודעה:" },
          { t: "big", text: shekel(lead.price!), tone: "blue" },
          { t: "title", text: "המחיר אחרי המבצע:", mark: "אחרי המבצע" },
          { t: "big", text: shekel(lead.after!), tone: "red" },
          { t: "body", text: "את המספר השני כמעט אף אחד לא מראה לכם." },
        ],
      },
      {
        tag: rows.length > 1 ? `${rows.length} דוגמאות אמיתיות` : "דוגמה אמיתית",
        blocks: [
          { t: "title", text: "כמה עולה החבילה כשהמבצע נגמר" },
          {
            t: "rows",
            rows: rows.map((p) => ({
              label: p.provider,
              sub: p.stat ?? p.name,
              value: `${shekel(p.price!)} ← ${shekel(p.after!)}`,
              tone: "red" as const,
            })),
          },
          { t: "note", text: `מחיר לחודש, לקו. ${SOURCE_NOTE}` },
        ],
      },
      {
        tag: "שמרו את זה",
        blocks: [
          { t: "title", text: "3 שאלות לשאול את הנציג לפני שמסכימים" },
          {
            t: "checks",
            items: [
              "מה המחיר אחרי שההטבה נגמרת?",
              "באיזה חודש בדיוק היא נגמרת?",
              "כמה זה עולה לכל הקווים ביחד?",
            ],
          },
        ],
      },
      ctaSlide(
        "רוצים לדעת כמה אתם באמת תשלמו?",
        "שלחו לי צילום של החשבונית. אבדוק מתי ההטבה שלכם נגמרת ואם יש חבילה זולה יותר. בלי התחייבות.",
      ),
    ],
    caption: [
      `${shekel(lead.price!)} בחודש הראשון. ${shekel(lead.after!)} כשההטבה נגמרת. אותה חבילה בדיוק.`,
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

export function spotlightPost(p: StudioPackage): Post {
  const priceText =
    p.category === "electricity" ? `${p.discountPercent}% הנחה` : shekel(p.price!);
  const rows: { label: string; value: string; tone?: Tone }[] = [];
  if (p.stat) rows.push({ label: p.category === "electricity" ? "שעות ההנחה" : "מה כלול", value: p.stat });
  if (p.after != null) rows.push({ label: "אחרי תום ההטבה", value: shekel(p.after), tone: "red" });
  if (p.installation != null) {
    rows.push({ label: "התקנה", value: p.installation === 0 ? "ללא עלות" : shekel(p.installation) });
  }

  return {
    slides: [
      {
        tag: `${CATEGORY_HE[p.category]} · ${p.provider}`,
        blocks: [
          { t: "title", text: p.name },
          { t: "big", text: priceText, tone: "blue" },
          ...(p.category === "electricity" ? [] : [{ t: "body" as const, text: "לחודש" }]),
          ...(rows.length ? [{ t: "rows" as const, rows }] : []),
          { t: "note", text: SOURCE_NOTE },
        ],
      },
      ctaSlide(
        "רוצים לבדוק אם זה משתלם לכם?",
        "שלחו לי צילום של החשבונית, ואשווה אותה מול החבילה הזו ומול כל החברות. בלי התחייבות.",
      ),
    ],
    caption: [
      `${p.provider}: ${p.name}, ${priceText}${p.category === "electricity" ? "" : " לחודש"}.`,
      "",
      p.after != null
        ? `שימו לב: אחרי תום ההטבה המחיר עולה ל-${shekel(p.after)}. את זה כדאי לדעת לפני שמצטרפים.`
        : "לפני שמצטרפים, כדאי לבדוק מה קורה למחיר כשההטבה נגמרת.",
      "",
      `רוצים לדעת אם זה משתלם לכם? ${WHATSAPP_LINE}`,
      "",
      HASHTAGS[p.category],
    ].join("\n"),
  };
}

/* ── השוואת חבילות ────────────────────────────────────────────────── */

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
        tag: `השוואה · ${CATEGORY_HE[category]}`,
        blocks: [
          { t: "title", text: `${sorted.length} חבילות, אותה שאלה:`, mark: "אותה שאלה" },
          { t: "big", text: "מה באמת משתלם?", tone: "blue" },
          { t: "body", text: "השוויתי בשבילכם מחיר, מפרט ומה קורה כשההטבה נגמרת." },
        ],
      },
      {
        tag: "ההשוואה",
        blocks: [
          {
            t: "rows",
            rows: sorted.map((p) => ({
              label: p.provider,
              sub: [p.stat, p.after != null ? `אחר כך ${shekel(p.after)}` : null]
                .filter(Boolean)
                .join(" · "),
              value: isElec ? `${p.discountPercent}%` : shekel(p.price!),
              tone: "blue" as const,
            })),
          },
          { t: "note", text: `${isElec ? "אחוז הנחה מהחשבון." : "מחיר לחודש."} ${SOURCE_NOTE}` },
        ],
      },
      ctaSlide(
        "לא בטוחים מה מתאים לכם?",
        "שלחו לי צילום של החשבונית, ואגיד לכם איזו חבילה הכי משתלמת לשימוש שלכם. בלי התחייבות.",
      ),
    ],
    caption: [
      `השוויתי ${sorted.length} חבילות ${CATEGORY_HE[category]}, מהזולה ליקרה.`,
      "",
      "המחיר בכותרת הוא רק חלק מהסיפור: כדאי לבדוק גם את המפרט ומה קורה כשההטבה נגמרת.",
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

  return {
    slides: [
      {
        tag: "טיפ מאלירן",
        blocks: [
          { t: "title", text: title, mark: input.mark?.trim() || undefined },
          { t: "checks", items: points },
        ],
      },
      ctaSlide(
        "רוצים שאבדוק את החשבון שלכם?",
        "שלחו לי צילום של החשבונית. ייעוץ ללא עלות ובלי התחייבות.",
      ),
    ],
    caption: [title, "", ...points.map((p) => `✔️ ${p}`), "", WHATSAPP_LINE, "", "#חיסכון #צרכנות #סלולר #אינטרנט"].join(
      "\n",
    ),
  };
}
