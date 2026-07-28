"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/repositories";
import { requireSessionUser } from "@/server/auth/session";
import type {
  LeadCategoryKey,
  LeadKind,
  LeadStatus,
  Priority,
  ProviderKey,
} from "@/lib/domain/types";
import { STATUS_CONFIG } from "@/lib/domain/types";
import { isIsraeliPhone } from "@/lib/format";

/**
 * כל הכתיבות למסך הלידים.
 *
 * הפעולות כאן הן נקודות קצה אמיתיות — כל אחת חייבת לאמת את הקלט
 * בעצמה. אימות בצד הלקוח הוא נוחות, לא הגנה.
 *
 * ⚠️ אין כאן עדיין בדיקת הרשאות (מי מורשה לעשות מה) — רק זיהוי מי
 * מבצע את הפעולה, דרך הסשן האמיתי (`requireSessionUser`).
 */

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function actor(): Promise<string> {
  return (await requireSessionUser()).id;
}

/* ── יצירה ────────────────────────────────────────────────────────────── */

export async function createLeadAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (name.length < 2) return { ok: false, error: "שם מלא הוא שדה חובה" };
  if (!isIsraeliPhone(phone))
    return { ok: false, error: "מספר טלפון לא תקין — צריך להתחיל ב-0" };

  const email = String(formData.get("email") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const assigneeId = String(formData.get("assigneeId") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const currentProvider = String(formData.get("currentProvider") ?? "").trim();
  const actorId = await actor();

  await db.leads.create({
    name,
    phone,
    email: email || undefined,
    city: city || undefined,
    note: note || undefined,
    kind: (formData.get("kind") as LeadKind) ?? "data",
    priority: (formData.get("priority") as Priority) ?? "normal",
    category: (category as LeadCategoryKey) || undefined,
    currentProvider: (currentProvider as ProviderKey) || undefined,
    // ללא בחירה = משויך ליוצר, לא ל"ללא שיוך" — תואם לטופס האמיתי
    assigneeId: assigneeId || actorId,
    source: "manual",
    createdById: actorId,
  });

  revalidatePath("/leads");
  return { ok: true };
}

/* ── עריכה ────────────────────────────────────────────────────────────── */

/**
 * עריכת פרטי הליד.
 *
 * מריץ את אותה ולידציה כמו היצירה — אימות בצד הלקוח הוא נוחות, ופה
 * זו נקודת קצה שאפשר לקרוא לה ישירות.
 *
 * ⚠️ אין בדיקת הרשאות — כל משתמש מחובר יכול לערוך כל ליד, גם כזה
 * שמשויך למישהו אחר.
 */
export async function updateLeadAction(
  leadId: string,
  formData: FormData,
): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (name.length < 2) return { ok: false, error: "שם מלא הוא שדה חובה" };
  if (!isIsraeliPhone(phone))
    return { ok: false, error: "מספר טלפון לא תקין — צריך להתחיל ב-0" };

  const email = String(formData.get("email") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const assigneeId = String(formData.get("assigneeId") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const currentProvider = String(formData.get("currentProvider") ?? "").trim();

  await db.leads.update(leadId, {
    name,
    phone: phone.replace(/\D/g, ""),
    email: email || undefined,
    city: city || undefined,
    kind: (formData.get("kind") as LeadKind) ?? "data",
    priority: (formData.get("priority") as Priority) ?? "normal",
    category: (category as LeadCategoryKey) || undefined,
    currentProvider: (currentProvider as ProviderKey) || undefined,
    // בעריכה "ללא שיוך" הוא בחירה מפורשת, לא ברירת מחדל ליוצר
    assigneeId: assigneeId || undefined,
  });

  revalidatePath("/leads");
  return { ok: true };
}

/* ── שינוי סטטוס ──────────────────────────────────────────────────────── */

export async function changeStatusAction(
  leadId: string,
  to: LeadStatus,
  detail?: string,
  followUpDate?: string,
): Promise<ActionResult> {
  const meta = STATUS_CONFIG[to];
  if (!meta) return { ok: false, error: "סטטוס לא מוכר" };

  // הפירוט הוא מה שהופך את ההיסטוריה לשימושית — נאכף בשרת, לא רק בטופס
  if (meta.prompt?.required && !detail?.trim()) {
    return { ok: false, error: `${meta.prompt.question} — שדה חובה` };
  }

  let followUpAt: string | undefined;
  if (followUpDate) {
    const parsed = parseFollowUpDate(followUpDate);
    if (!parsed) return { ok: false, error: "תאריך החזרה לא תקין" };
    followUpAt = parsed;
  }

  await db.leads.changeStatus({
    leadId,
    to,
    detail: detail?.trim() || undefined,
    actorId: await actor(),
    followUpAt,
  });

  revalidatePath("/leads");
  return { ok: true };
}

/**
 * `YYYY-MM-DD` מ-`<input type="date">` → חותמת זמן ב-09:00 מקומי.
 *
 * לא חצות ולא סוף היום: `until()` מעגל כלפי מעלה את הפרש הימים, והסינון
 * "לחזור היום" משווה מול סוף היום המקומי. 09:00 הוא הערך היחיד שגורם
 * לשניהם להציג את אותו יום — חצות היה נופל ליום הקודם באזורי זמן
 * מסוימים, וסוף יום היה מקדים את הליד ביום.
 */
function parseFollowUpDate(raw: string): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!match) return undefined;

  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d), 9, 0, 0, 0);
  if (Number.isNaN(date.getTime())) return undefined;

  // תאריך בעבר הוא כמעט תמיד טעות הקלדה, לא כוונה
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date < yesterday) return undefined;

  return date.toISOString();
}

/* ── שיוך ─────────────────────────────────────────────────────────────── */

export async function assignAction(
  leadIds: string[],
  assigneeId: string | null,
): Promise<ActionResult> {
  if (leadIds.length === 0) return { ok: false, error: "לא נבחרו לידים" };

  if (assigneeId) {
    const user = await db.users.getById(assigneeId);
    if (!user) return { ok: false, error: "העובד לא נמצא" };
    if (!user.active) return { ok: false, error: "העובד אינו פעיל" };
  }

  await db.leads.assign(leadIds, assigneeId, await actor());
  revalidatePath("/leads");
  return { ok: true };
}

/* ── עלות וכוכב ───────────────────────────────────────────────────────── */

/**
 * עלות פרטנית לליד.
 *
 * `null` מנקה אותה ומחזיר לעלות של הקטגוריה; `0` הוא ערך אמיתי
 * שמשמעותו "הליד היה חינם". שני מצבים שונים, ולכן שני ערכים שונים.
 *
 * ⚠️ אין בדיקת הרשאות — הערך הזה מזיז כל מספר רווח במערכת.
 */
export async function setLeadCostAction(
  leadId: string,
  cost: number | null,
): Promise<ActionResult> {
  if (cost !== null && (!Number.isFinite(cost) || cost < 0)) {
    return { ok: false, error: "עלות חייבת להיות מספר חיובי" };
  }

  const rounded = cost === null ? null : Math.round(cost * 100) / 100;

  await db.leads.update(leadId, { cost: rounded });
  await db.leads.logActivity({
    leadId,
    type: "costChanged",
    detail: rounded === null ? "אופסה לעלות הקטגוריה" : `${rounded} ₪`,
    actorId: await actor(),
  });

  revalidatePath("/leads");
  return { ok: true };
}

export async function toggleStarAction(
  leadId: string,
  next: boolean,
): Promise<ActionResult> {
  await db.leads.update(leadId, { isStarred: next });
  await db.leads.logActivity({
    leadId,
    type: next ? "starred" : "unstarred",
    actorId: await actor(),
  });

  revalidatePath("/leads");
  return { ok: true };
}

/* ── הערות ────────────────────────────────────────────────────────────── */

export async function addNoteAction(
  leadId: string,
  body: string,
): Promise<ActionResult> {
  const text = body.trim();
  if (!text) return { ok: false, error: "ההערה ריקה" };

  await db.leads.addNote(leadId, await actor(), text);
  revalidatePath("/leads");
  return { ok: true };
}

/* ── מחיקה ────────────────────────────────────────────────────────────── */

export async function deleteLeadsAction(
  leadIds: string[],
): Promise<ActionResult> {
  if (leadIds.length === 0) return { ok: false, error: "לא נבחרו לידים" };

  await db.leads.remove(leadIds);
  revalidatePath("/leads");
  return { ok: true };
}

/* ── ייבוא ────────────────────────────────────────────────────────────── */

export interface ImportRow {
  name: string;
  phone: string;
  email?: string;
  city?: string;
  category?: LeadCategoryKey;
  kind?: LeadKind;
  note?: string;
}

export interface ImportResult {
  imported: number;
  /** שורות שנפסלו על ולידציה (שם קצר מדי או טלפון לא תקין) */
  skipped: number;
  /** שורות תקינות שדולגו כי הטלפון כבר קיים */
  duplicates: number;
}

/**
 * תקרת שורות לייבוא יחיד.
 *
 * `createMany` הוא create סדרתי בשני המימושים (כל שורה צריכה רשומת
 * היסטוריה משלה), כך שקובץ ענק שנבחר בטעות היה תוקע את הבקשה.
 */
const MAX_IMPORT_ROWS = 5_000;

export async function importLeadsAction(
  rows: ImportRow[],
): Promise<ActionResult<ImportResult>> {
  if (rows.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      error: `הקובץ מכיל ${rows.length} שורות — המקסימום לייבוא אחד הוא ${MAX_IMPORT_ROWS}`,
    };
  }

  const valid = rows.filter(
    (r) => r.name?.trim().length >= 2 && isIsraeliPhone(r.phone ?? ""),
  );
  const skipped = rows.length - valid.length;

  // נרמול לפני הדדופ — "050-123-4567" ו-"0501234567" הם אותו ליד
  const normalized = valid.map((r) => ({
    ...r,
    phone: r.phone.replace(/\D/g, ""),
  }));

  // דדופ בתוך הקובץ עצמו, ואז מול מה שכבר קיים במערכת
  const seen = new Set<string>();
  const withinFile = normalized.filter((r) => {
    if (seen.has(r.phone)) return false;
    seen.add(r.phone);
    return true;
  });

  const existing = await db.leads.findPhones(withinFile.map((r) => r.phone));
  const fresh = withinFile.filter((r) => !existing.has(r.phone));
  const duplicates = normalized.length - fresh.length;

  if (fresh.length === 0) {
    return {
      ok: false,
      error: duplicates
        ? "כל השורות בקובץ כבר קיימות במערכת"
        : "לא נמצאו שורות תקינות בקובץ",
    };
  }

  const actorId = await actor();

  await db.leads.createMany(
    fresh.map((r) => ({
      name: r.name.trim(),
      phone: r.phone,
      email: r.email?.trim() || undefined,
      city: r.city?.trim() || undefined,
      note: r.note?.trim() || undefined,
      category: r.category,
      kind: r.kind ?? "data",
      priority: "normal" as const,
      source: "import" as const,
      createdById: actorId,
    })),
  );

  revalidatePath("/leads");
  return {
    ok: true,
    data: { imported: fresh.length, skipped, duplicates },
  };
}
