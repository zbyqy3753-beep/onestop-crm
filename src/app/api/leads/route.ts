import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { db } from "@/server/repositories";
import { partnerFromKey, type ApiPartner } from "@/server/auth/apiKeys";
import type { LeadCategoryKey, ProviderKey, Role } from "@/lib/domain/types";
import { matchLeadCategory } from "@/lib/domain/types";
import {
  cleanText,
  matchProvider,
  parseInterest,
} from "@/lib/domain/interest";

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

/** ניקוי תווי כיווניות + trim — ראה `lib/domain/interest.ts`. */
const text = cleanText;

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

/**
 * שם החבילה, תחת כל אחד מהשמות שהשותפים משתמשים בהם בפועל.
 * `packageName` הוא החוזה המתועד; השאר הם קליטה סלחנית.
 */
function pickPackage(body: LeadPayload): string {
  return text(body.packageName) || text(body.package) || text(body.plan);
}

/** כל שם שדה שהחוזה מכיר ומטפל בו. כל השאר נחשב "לא זוהה". */
const KNOWN_FIELDS: ReadonlySet<string> = new Set([
  "fullName",
  "phone",
  "email",
  "source",
  "category",
  "message",
  "packageName",
  "package",
  "plan",
  "providerName",
  "price",
]);

/**
 * שדות שהשותף שלח ואנחנו לא מכירים — לתוך ההערה, במקום לאבד בשקט.
 *
 * ⚠️ הסיבה שזה קיים: כשליד נכנס בלי חבילה אי אפשר היה לדעת אם השותף
 * לא שלח אחת, או ששלח אותה תחת שם שדה שאנחנו מתעלמים ממנו. אנחנו לא
 * שומרים את גוף הבקשה הגולמי, ולכן ההבדל הזה היה בלתי ניתן לבירור
 * אחרי המעשה — והשאלה "למה אין פה חבילה" נשארה בלי תשובה.
 *
 * הרשימה חתוכה בכוונה: המטרה היא רמז לתחקיר, לא ארכיון. שדה שמופיע
 * כאן שוב ושוב הוא סימן שצריך למפות אותו לעמודה אמיתית.
 */
const MAX_UNKNOWN_FIELDS = 10;
const MAX_UNKNOWN_VALUE = 120;

function unknownFields(body: LeadPayload): string {
  const seen: string[] = [];

  for (const [key, value] of Object.entries(body)) {
    if (KNOWN_FIELDS.has(key)) continue;
    if (value === null || value === undefined || value === "") continue;
    if (seen.length === MAX_UNKNOWN_FIELDS) break;

    const shown =
      typeof value === "object" ? JSON.stringify(value) : String(value);
    seen.push(`${key}=${shown.slice(0, MAX_UNKNOWN_VALUE)}`);
  }

  return seen.length ? `שדות שלא זוהו: ${seen.join(", ")}` : "";
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

  const unknown = unknownFields(body);
  if (unknown) lines.push(unknown);

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

  // גם התווית העברית מתקבלת ("טריפל"), ולא רק מפתח החוזה ("triple").
  // קודם היא החזירה 400 — כלומר שותף שראה את הקטגוריות בממשק ושלח את
  // מה שכתוב שם קיבל דחייה, בלי שום דו-משמעות בערך עצמו.
  const rawCategory = text(body.category);
  const category = rawCategory
    ? (CATEGORY_MAP[rawCategory.toLowerCase()] ?? matchLeadCategory(rawCategory))
    : undefined;
  if (rawCategory && !category) {
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

  // קטגוריה, חבילה וספק: קודם מה שנשלח מפורשות, ומה שחסר — מתוך `source`.
  const rawSource = text(body.source);
  const fromSource = parseInterest(rawSource);
  const explicitPackage = pickPackage(body);
  const packageName = explicitPackage || fromSource.packageName || "";
  const currentProvider =
    matchProvider(text(body.providerName)) ?? fromSource.provider;

  // אם `source` פוענח לעמודות אמיתיות, השארתו גם כ"מקור" הייתה כפילות.
  // כשנשלחה חבילה מפורשת משאירים אותו כמו שהוא — אז הוא לא נצרך.
  const consumedSource =
    Boolean(fromSource.category ?? fromSource.packageName) && !explicitPackage;
  const sourceDetail = consumedSource ? partner.name : rawSource || partner.name;

  const lead = await db.leads.create({
    name,
    phone,
    email: email || undefined,
    // ליד שמגיע מטופס חי הוא ליד חם, לא רשומת דאטה
    kind: "hot",
    priority: "normal",
    category: category ?? fromSource.category,
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
