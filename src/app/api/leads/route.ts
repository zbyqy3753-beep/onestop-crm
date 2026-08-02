import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { db } from "@/server/repositories";
import { partnerFromKey, type ApiPartner } from "@/server/auth/apiKeys";
import type { LeadCategoryKey, ProviderKey, Role } from "@/lib/domain/types";
import { PROVIDER_CONFIG, PROVIDER_ORDER } from "@/lib/domain/types";

/**
 * `POST /api/leads` — קליטת לידים משותפים חיצוניים.
 *
 * זו נקודת הכניסה היחידה למערכת שאינה עוברת דרך הסשן: שותף (אתר,
 * דף נחיתה, מערכת של ספק) שולח ליד בודד ומקבל את מזהה הליד שנוצר.
 * האימות הוא מפתח בכותרת `x-api-key` (ראה `server/auth/apiKeys.ts`).
 *
 * הקצה מיועד לקריאה **שרת-אל-שרת**. אין כאן כותרות CORS בכוונה —
 * קריאה מדפדפן הייתה מחייבת להטמיע את המפתח ב-JS של הדף, כלומר
 * לפרסם אותו. שותף שרוצה טופס בדפדפן צריך לתווך אותו דרך השרת שלו.
 *
 * חוזה הבקשה מתועד ב-`docs/leads-api.md` — זהו המסמך שנשלח לשותפים.
 *
 * ⚠️ הנתיב פתוח בשער הגישה (`src/proxy.ts`), ולכן הוא מאמת את עצמו
 * ואסור לו להסתמך על שום שכבה שמעליו.
 */

/* ── חוזה ─────────────────────────────────────────────────────────────── */

interface LeadPayload {
  fullName?: unknown;
  phone?: unknown;
  email?: unknown;
  source?: unknown;
  category?: unknown;
  message?: unknown;
  packageName?: unknown;
  /** כינויים נפוצים ל-`packageName` — ראה `pickPackage` */
  package?: unknown;
  plan?: unknown;
  providerName?: unknown;
  price?: unknown;
}

/** קטגוריות החוזה החיצוני → מפתחות הדומיין. */
const CATEGORY_MAP: Record<string, LeadCategoryKey> = {
  // השותפים מקבלים "cellular"; בדומיין הפנימי זה "mobile"
  cellular: "mobile",
  mobile: "mobile",
  internet: "internet",
  tv: "tv",
  triple: "triple",
  electricity: "electricity",
  general: "general",
};

/** גוף בקשה סביר הוא כמה מאות בתים. מעבר לזה — לא ליד. */
const MAX_BODY_BYTES = 16_384;

/* ── הגבלת קצב ────────────────────────────────────────────────────────── */

/**
 * חלון מתגלגל פשוט לכל שותף.
 *
 * ⚠️ המונה חי בזיכרון התהליך. בפריסה serverless (Vercel) לכל אינסטנס
 * יש מונה משלו, ולכן התקרה האפקטיבית גבוהה מהמספר שכאן. זה מכוון:
 * המטרה היא לעצור שותף עם באג בלולאה, לא להיות מכסה מדויקת. מכסה
 * אמיתית תדרוש מונה משותף (Redis), וזה לא מוצדק בסדר הגודל הזה.
 */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_WINDOW = 120;

const hits = new Map<string, number[]>();

function overRateLimit(partnerName: string): boolean {
  const now = Date.now();
  const recent = (hits.get(partnerName) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  );
  recent.push(now);
  hits.set(partnerName, recent);
  return recent.length > RATE_MAX_PER_WINDOW;
}

/* ── עזרי נרמול ───────────────────────────────────────────────────────── */

/**
 * תווי בקרת כיווניות (LRM/RLM/isolates). מערכות שמרכיבות מחרוזות
 * מעורבות עברית-אנגלית מזריקות אותם כדי שהתצוגה שלהן תיראה נכון, והם
 * מגיעים אלינו בתוך הערך. הם בלתי נראים אבל אמיתיים: בלי ניקוי,
 * `"‎פלאפון"` לא שווה ל-`"פלאפון"` בזיהוי הספק, והם נשמרים ל-DB.
 */
const BIDI_MARKS = /[‎‏‪-‮⁦-⁩]/g;

function text(value: unknown): string {
  return typeof value === "string" ? value.replace(BIDI_MARKS, "").trim() : "";
}

/**
 * טלפון ישראלי לספרות בלבד, או `null` אם הוא לא תקין.
 * `+972-50-123-4567` ו-`050 123 4567` הם אותו מספר, ושניהם מגיעים
 * בפועל משדות טופס של שותפים.
 */
function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("972")) digits = `0${digits.slice(3)}`;
  return /^0\d{8,9}$/.test(digits) ? digits : null;
}

/** שם ספק בטקסט חופשי → מפתח ספק מוכר, אם יש התאמה. */
function matchProvider(raw: string): ProviderKey | undefined {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return undefined;

  return PROVIDER_ORDER.find(
    (key) =>
      key === normalized ||
      PROVIDER_CONFIG[key].label.toLowerCase() === normalized,
  );
}

/**
 * שם החבילה, תחת כל אחד מהשמות שהשותפים משתמשים בהם בפועל.
 * `packageName` הוא החוזה המתועד; השאר הם קליטה סלחנית.
 */
function pickPackage(body: LeadPayload): string {
  return text(body.packageName) || text(body.package) || text(body.plan);
}

/**
 * מפריד שדה `source` מהצורה `"חבילה – ספק"` לשני חלקיו.
 *
 * ⚠️ זה לא ניחוש: השותפים דוחפים בפועל `"ULTIMATE – YES"` ו-
 * `"פלאפון – 500GB 5G Together"` לתוך `source`, בלי לשלוח `packageName`
 * או `providerName` בכלל. בלי הפירוק כאן שני שדות אמיתיים נשארים ריקים
 * והמידע קבור בעמודה חופשית שכבויה כברירת מחדל.
 *
 * **סדר החלקים הפוך בין השותפים** (בדוגמאות למעלה הספק פעם שני ופעם
 * ראשון), ולכן אין כאן הנחה על מיקום: הצד שמזוהה כספק מוכר הוא הספק,
 * והשני הוא החבילה. אם אף צד או שני הצדדים מזוהים — לא נוגעים בכלום,
 * כי אז אין דרך לדעת מה זה מה.
 */
const SOURCE_SPLIT = /\s+[–—|-]\s+/;

function splitSource(raw: string): {
  packageName?: string;
  provider?: ProviderKey;
} {
  const parts = raw.split(SOURCE_SPLIT).map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 2) return {};

  const [first, second] = parts;
  const firstIsProvider = matchProvider(first);
  const secondIsProvider = matchProvider(second);

  if (firstIsProvider && !secondIsProvider) {
    return { provider: firstIsProvider, packageName: second };
  }
  if (secondIsProvider && !firstIsProvider) {
    return { provider: secondIsProvider, packageName: first };
  }
  return {};
}

/**
 * כל מה שהשותף שלח ואין לו עמודה משלו — לתוך ההערה הראשונה של הליד.
 * עדיף מלאבד את המידע: הנציג שמרים טלפון רואה מה הלקוח ביקש.
 */
function buildNote(body: LeadPayload, provider: ProviderKey | undefined): string {
  const lines: string[] = [];

  const message = text(body.message);
  if (message) lines.push(message);

  // שם החבילה **לא** נכנס להערה — יש לו עמודה משלו (`packageName`),
  // וכפילות הייתה יוצרת שני מקומות שיכולים להיפרד בעריכה

  // שם ספק שזוהה כבר יושב בעמודה `currentProvider` — לא כופלים אותו
  const providerName = text(body.providerName);
  if (providerName && !provider) lines.push(`ספק: ${providerName}`);

  const price = body.price;
  if (typeof price === "number" && Number.isFinite(price)) {
    lines.push(`מחיר: ${price} ₪`);
  } else if (text(price)) {
    lines.push(`מחיר: ${text(price)}`);
  }

  return lines.join("\n");
}

/* ── תשובות ───────────────────────────────────────────────────────────── */

function fail(status: number, error: string): Response {
  return Response.json({ success: false, error }, { status });
}

/**
 * מי נרשם כיוצר הליד.
 *
 * `createdById` הוא מפתח זר חובה — לליד שנכנס מבחוץ אין משתמש
 * אנושי, ולכן הוא נתלה בבעלים. אין כאן יצירת משתמש-רפאים: הבעלים
 * הוא ממילא מי שאחראי על לידים שטרם שויכו.
 */
async function ownerId(): Promise<string | null> {
  const users = await db.users.listActive();
  return (users.find((u) => u.role === "owner") ?? users[0])?.id ?? null;
}

/**
 * מי נחשב "נציג" לצורך חלוקת לידים — השורה הקדמית בלבד.
 *
 * `agent` ו-`employee` הם אותה דרגה ב-`ROLE_CONFIG` (rank 10), ובפועל
 * רוב המשתמשים נושאים `employee`. מנהלים ובעלים לא נכללים: הם עובדים
 * על לידים לפעמים, אבל תור אוטומטי שנוחת עליהם הוא כמעט תמיד טעות.
 */
const FRONT_LINE: readonly Role[] = ["agent", "employee"];

/**
 * למי לשייך את הליד הנכנס.
 *
 * ⚠️ **ברירת המחדל היא ללא שיוך.** ליד שנכנס מה-API נוחת במאגר וגלוי
 * רק להנהלה, עד שמנהל משייך אותו לעובד. זו החלטה תפעולית מודעת: את
 * חלוקת הלידים עושים בני אדם, לא אלגוריתם.
 *
 * זה גם מה שסוגר את הלולאה עם הרשאות הצפייה — עובד רואה אך ורק לידים
 * שמשויכים אליו (`lib/domain/permissions.ts`), ולכן ליד ששויך
 * אוטומטית היה מגיע לעובד בלי שאיש החליט על כך.
 *
 * `LEADS_API_AUTO_ASSIGN="on"` מפעיל חלוקה אוטומטית: הליד הולך לנציג
 * הפעיל עם הכי מעט לידים פתוחים. "הכי פחות עמוס" ולא סבב מחזורי, כי
 * סבב דורש לזכור מי היה אחרון; העומס כבר יושב ב-DB ומתקן את עצמו.
 * שוויון נשבר לפי סדר השמות, כך שהתוצאה דטרמיניסטית.
 */
async function nextAssignee(): Promise<string | undefined> {
  if (process.env.LEADS_API_AUTO_ASSIGN !== "on") return undefined;

  const agents = (await db.users.listActive()).filter((u) =>
    FRONT_LINE.includes(u.role),
  );
  if (agents.length === 0) return undefined;

  const load = await db.leads.countOpenByAssignee();
  const lightest = agents.reduce((best, agent) =>
    (load[agent.id] ?? 0) < (load[best.id] ?? 0) ? agent : best,
  );
  return lightest.id;
}

/* ── הנקודה עצמה ──────────────────────────────────────────────────────── */

export async function POST(request: NextRequest): Promise<Response> {
  const partner = partnerFromKey(request.headers.get("x-api-key"));
  if (!partner) return fail(401, "מפתח API חסר או לא תקין");

  if (overRateLimit(partner.name)) {
    return Response.json(
      { success: false, error: "יותר מדי בקשות — נסה שוב בעוד דקה" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return fail(413, "גוף הבקשה גדול מדי");

  let body: LeadPayload;
  try {
    body = JSON.parse(raw) as LeadPayload;
  } catch {
    return fail(400, "גוף הבקשה אינו JSON תקין");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return fail(400, "גוף הבקשה חייב להיות אובייקט JSON");
  }

  const name = text(body.fullName);
  if (name.length < 2) return fail(400, "fullName הוא שדה חובה");

  const phone = normalizePhone(text(body.phone));
  if (!phone) return fail(400, "phone לא תקין — נדרש מספר ישראלי");

  const rawCategory = text(body.category).toLowerCase();
  if (rawCategory && !(rawCategory in CATEGORY_MAP)) {
    return fail(
      400,
      `category לא מוכר: "${rawCategory}". ערכים אפשריים: ${Object.keys(CATEGORY_MAP).join(" | ")}`,
    );
  }

  // הטלפון הוא מפתח הכפילות בכל המערכת (ייבוא CSV נשען על אותו כלל).
  // שותף שמנסה שוב אחרי timeout לא אמור ליצור ליד שני — ולכן זו
  // תשובת הצלחה עם `duplicate`, לא שגיאה שתגרור עוד ניסיונות.
  const existing = await db.leads.findPhones([phone]);
  if (existing.has(phone)) {
    const { rows } = await db.leads.list({ query: phone }, undefined, {
      offset: 0,
      limit: 1,
    });
    return Response.json({
      success: true,
      duplicate: true,
      id: rows[0]?.id ?? null,
    });
  }

  const createdById = await ownerId();
  if (!createdById) {
    return fail(503, "אין משתמשים במערכת — לא ניתן לשייך את הליד");
  }

  const email = text(body.email);

  // החבילה והספק: קודם מה שנשלח מפורשות, ומה שחסר — מתוך `source`.
  const rawSource = text(body.source);
  const fromSource = splitSource(rawSource);
  const explicitPackage = pickPackage(body);
  const packageName = explicitPackage || fromSource.packageName || "";
  const currentProvider = matchProvider(text(body.providerName)) ?? fromSource.provider;

  // אם `source` פורק ושני חלקיו נחתו בעמודות אמיתיות, השארתו כ"מקור"
  // הייתה כפילות משולשת. במקרה כזה המקור הוא פשוט שם השותף.
  const sourceDetail =
    fromSource.packageName && !explicitPackage
      ? partner.name
      : rawSource || partner.name;

  const lead = await db.leads.create({
    name,
    phone,
    email: email || undefined,
    // ליד שמגיע מטופס חי הוא ליד חם, לא רשומת דאטה
    kind: "hot",
    priority: "normal",
    category: rawCategory ? CATEGORY_MAP[rawCategory] : undefined,
    currentProvider,
    // `source` נשאר "campaign" (איך הליד נקלט); שם השותף נכנס
    // ל-`sourceDetail`, העמודה החופשית שמוצגת בטבלה כ"מקור"
    source: "campaign",
    sourceDetail,
    packageName: packageName || undefined,
    note: buildNote(body, currentProvider) || undefined,
    assigneeId: await nextAssignee(),
    createdById,
  });

  revalidatePath("/leads");
  return Response.json({ success: true, id: lead.id }, { status: 201 });
}

/**
 * בדיקת חיים לשותף — מאשרת שהמפתח שקיבל אכן עובד, בלי ליצור ליד.
 * לא חושפת דבר בלי מפתח תקין.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const partner: ApiPartner | null = partnerFromKey(
    request.headers.get("x-api-key"),
  );
  if (!partner) return fail(401, "מפתח API חסר או לא תקין");

  return Response.json({ success: true, partner: partner.name });
}
