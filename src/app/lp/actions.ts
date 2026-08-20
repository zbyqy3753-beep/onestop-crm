"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/server/repositories";
import {
  isLeadCategory,
  isProvider,
  type LeadCategoryKey,
  type ProviderKey,
} from "@/lib/domain/types";
import { cleanText } from "@/lib/domain/interest";
import {
  DEFAULT_ASSIGNEE_EMAIL,
  DEFAULT_SOURCE_DETAIL,
  LANDING_CATEGORIES,
} from "./config";

/**
 * שליחת דף הנחיתה הציבורי (`/lp`).
 *
 * ⚠️ **Server Action ולא קריאה ל-`POST /api/leads`, בכוונה.** ה-API
 * מיועד לשרת-אל-שרת ומאמת `x-api-key`; קריאה אליו מהדפדפן הייתה
 * מחייבת להטמיע את המפתח ב-JS של הדף — כלומר לפרסם אותו לכל מי
 * שפותח "הצג מקור". הפעולה הזו רצה על אותו שרת ואין לה מפתח בכלל.
 *
 * ⚠️ הנתיב פתוח בשער הגישה (`src/proxy.ts`), ולכן כל אימות כאן הוא
 * האימות היחיד. אין שכבה מעל שמסננת משהו.
 */

/* ── תוצאה ────────────────────────────────────────────────────────────── */

export type LandingState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "error"; message: string };

function error(message: string): LandingState {
  return { status: "error", message };
}

/* ── הגבלת קצב ────────────────────────────────────────────────────────── */

/**
 * חלון מתגלגל לכל כתובת IP.
 *
 * ⚠️ אותה מגבלה מוכרת כמו ב-`api/leads/route.ts`: המונה חי בזיכרון
 * התהליך, ובפריסה serverless לכל אינסטנס מונה משלו. המטרה היא לבלום
 * סקריפט שמפציץ בלולאה, לא להיות מכסה מדויקת.
 */
const RATE_WINDOW_MS = 10 * 60_000;
const RATE_MAX_PER_WINDOW = 8;

const hits = new Map<string, number[]>();

function overRateLimit(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_MAX_PER_WINDOW;
}

/**
 * כתובת ה-IP של השולח, לפי הכותרת ש-Vercel מציב.
 *
 * ⚠️ `x-forwarded-for` הוא רשימה — הפרוקסי מוסיף לסופה. הערך הראשון
 * הוא הלקוח; לקיחת המחרוזת כולה הייתה יוצרת מפתח מונה חדש בכל פעם
 * שמסלול הרשת משתנה, כלומר הגבלת קצב שלא מגבילה כלום.
 */
async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return (
    forwarded?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "unknown"
  );
}

/* ── נרמול ────────────────────────────────────────────────────────────── */

/**
 * ערך שדה מנוקה. `cleanText` (מ-`lib/domain/interest`) מסיר תווי
 * כיווניות — אותה פונקציה שקליטת ה-API משתמשת בה, כדי ששתי דרכי
 * הכניסה לא ינרמלו טקסט בשתי צורות שונות.
 */
function text(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? cleanText(value) : "";
}

/** טלפון ישראלי לספרות בלבד, או `null` אם אינו תקין. */
function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("972")) digits = `0${digits.slice(3)}`;
  return /^0\d{8,9}$/.test(digits) ? digits : null;
}

const ALLOWED_CATEGORIES = new Set<string>(
  LANDING_CATEGORIES.map((c) => c.key),
);

function parseCategory(raw: string): LeadCategoryKey | null {
  if (!ALLOWED_CATEGORIES.has(raw)) return null;
  return isLeadCategory(raw) ? raw : null;
}

function parseProvider(raw: string): ProviderKey | undefined {
  return isProvider(raw) ? raw : undefined;
}

/* ── יעד הליד ─────────────────────────────────────────────────────────── */

const MAX_NAME = 80;
const MAX_MESSAGE = 500;
/** שם חבילה מהקטלוג. הארוכה ביותר היום היא ~70 תווים. */
const MAX_PACKAGE = 120;
/** חלון הכפילות — פנייה חוזרת של אותו אדם באותו יום אינה ליד שני. */
const DUPLICATE_WINDOW_MS = 24 * 60 * 60_000;

function assigneeEmail(): string {
  return process.env.LANDING_ASSIGNEE_EMAIL?.trim() || DEFAULT_ASSIGNEE_EMAIL;
}

function sourceDetail(): string {
  return process.env.LANDING_SOURCE_DETAIL?.trim() || DEFAULT_SOURCE_DETAIL;
}

/* ── הפעולה ───────────────────────────────────────────────────────────── */

export async function submitLandingLead(
  _prev: LandingState,
  formData: FormData,
): Promise<LandingState> {
  /*
   * ⚠️ שדה הפיתיון נבדק ראשון, ולפני כל נגיעה במסד. הוא מוסתר
   * ב-CSS ואדם לא רואה אותו; בוט שממלא כל `input` בטופס ממלא גם
   * אותו. התשובה היא "נשלח" ולא שגיאה — בוט שמקבל שגיאה מנסה שוב
   * עם וריאציה, ובוט שמקבל הצלחה הולך הלאה.
   */
  if (text(formData.get("website"))) return { status: "sent" };

  const name = text(formData.get("name"));
  if (name.length < 2) return error("נא למלא שם מלא");
  if (name.length > MAX_NAME) return error("השם ארוך מדי");

  const phone = normalizePhone(text(formData.get("phone")));
  if (!phone) return error("מספר טלפון לא תקין — נדרש מספר ישראלי");

  const category = parseCategory(text(formData.get("category")));
  if (!category) return error("נא לבחור מה מעניין אותך");

  const currentProvider = parseProvider(text(formData.get("provider")));
  const message = text(formData.get("message")).slice(0, MAX_MESSAGE);

  /*
   * החבילה שהגולש לחץ עליה. יש לה עמודה משלה ב-CRM ולכן היא **לא**
   * נכנסת להערה — כפילות הייתה יוצרת שני מקומות שיכולים להיפרד בעריכה,
   * בדיוק כפי שמתועד ב-`api/leads/route.ts`.
   */
  const packageName = text(formData.get("packageName")).slice(0, MAX_PACKAGE);

  if (overRateLimit(await clientIp())) {
    return error("נשלחו יותר מדי פניות מהמכשיר הזה. נסו שוב מאוחר יותר.");
  }

  const source = sourceDetail();

  /*
   * כפילות: אותו טלפון, מאותו דף, ב-24 השעות האחרונות.
   *
   * ⚠️ **חלון זמן ולא `findPhones` הגלובלי**, בניגוד ל-`api/leads`.
   * שם כל טלפון שקיים במאגר נחשב כפילות — כאן זה היה בולע פנייה
   * אמיתית של לקוח שכבר דיבר איתנו לפני שנה, והיא לא הייתה מגיעה
   * לאיש. מה שצריך להיחסם הוא לחיצה כפולה על "שליחה", וזה בדיוק
   * מה שהחלון הזה תופס.
   */
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
  const recent = await db.leads.list(
    { query: phone, sourceDetail: source, createdFrom: since },
    { field: "createdAt", direction: "desc" },
    { offset: 0, limit: 1 },
  );
  if (recent.total > 0) return { status: "sent" };

  /*
   * הנמען. ⚠️ עובד מושבת נחשב "לא נמצא": ליד ששויך לחשבון שאינו
   * פעיל אינו גלוי לאיש — לא לו, כי אינו נכנס, ולא להנהלה, שרואה
   * את המאגר הלא-משויך. עדיף לידים ללא שיוך על לידים שנעלמו.
   */
  const assignee = await db.users.getByEmail(assigneeEmail());
  const assigneeId = assignee?.active ? assignee.id : undefined;

  /*
   * `createdById` הוא מפתח זר חובה. הנמען הוא גם היוצר הטבעי כאן —
   * זה הדף שלו. כשהוא חסר נופלים לבעלים, בדיוק כמו `api/leads`.
   */
  let createdById = assigneeId;
  if (!createdById) {
    const users = await db.users.listActive();
    createdById = (users.find((u) => u.role === "owner") ?? users[0])?.id;
  }
  if (!createdById) {
    return error("שגיאה זמנית בשמירת הפנייה. נסו שוב בעוד רגע.");
  }

  await db.leads.create({
    name,
    phone,
    // ליד שמילא טופס מרצונו הוא ליד חם, לא רשומת דאטה
    kind: "hot",
    priority: "normal",
    category,
    currentProvider,
    // `source` אומר **איך** נקלט (טופס), `sourceDetail` אומר **ממה**
    source: "form",
    sourceDetail: source,
    packageName: packageName || undefined,
    note: message || undefined,
    assigneeId,
    createdById,
  });

  revalidatePath("/leads");
  return { status: "sent" };
}
