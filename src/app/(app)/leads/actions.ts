"use server";

import { db } from "@/server/repositories";
import { requireSessionUser } from "@/server/auth/session";
import type {
  LeadCategoryKey,
  LeadKind,
  LeadStatus,
  Priority,
  ProviderKey,
} from "@/lib/domain/types";
import {
  STATUS_CONFIG,
  isLeadCategory,
  isLeadKind,
  isLeadStatus,
  isPriority,
  isProvider,
} from "@/lib/domain/types";
import { isIsraeliPhone } from "@/lib/format";
import { canSeeAllLeads } from "@/lib/domain/permissions";
import { revalidateLeadSurfaces } from "@/app/(app)/_revalidate";

/**
 * כל הכתיבות למסך הלידים.
 *
 * הפעולות כאן הן נקודות קצה אמיתיות — כל אחת חייבת לאמת את הקלט
 * בעצמה. אימות בצד הלקוח הוא נוחות, לא הגנה.
 *
 * כל פעולה כאן מאמתת סשן בעצמה. השער ב-`proxy.ts` בודק רק שקיימת
 * עוגיית סשן, לא שהיא מצביעה למשתמש אמיתי, ו-Server Action אפשר
 * לקרוא ישירות — כך ש-`requireSessionUser` הוא ההגנה בפועל.
 *
 * ההרשאה הפרטנית נאכפת דרך `assertCanEdit`: מנהל עורך כל ליד, עובד
 * עורך רק לידים שמשויכים אליו או שאינם משויכים לאיש.
 */

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function actor(): Promise<string> {
  return (await requireSessionUser()).id;
}

/** מוחזר כשעובד מנסה לגעת בליד של מישהו אחר. */
const FORBIDDEN = "אין לך הרשאה לערוך את הליד הזה";

/**
 * בדיקת בעלות על ליד.
 *
 * ⚠️ **זו ההרשאה האמיתית, לא הסינון במסך.** `leads/page.tsx` רק
 * מחליט מה *מוצג*; Server Action אפשר לקרוא ישירות עם כל מזהה ליד,
 * ולכן בלי הבדיקה כאן עובד היה יכול לערוך או למחוק ליד של עמית
 * פשוט על ידי ניחוש מזהה.
 *
 * ליד ללא שיוך **גם הוא חסום** לעובד, בהתאמה מלאה למה שהוא רואה
 * במסך: חלוקת לידים היא באחריות ההנהלה, ועובד לא לוקח לעצמו ליד
 * מהמאגר.
 *
 * מחזיר `null` כשמותר, או הודעת שגיאה כשאסור.
 */
async function assertCanEdit(leadIds: string[]): Promise<string | null> {
  const user = await requireSessionUser();
  if (canSeeAllLeads(user.role)) return null;

  for (const id of leadIds) {
    const lead = await db.leads.getById(id);
    // ליד שלא קיים נבלע כאן בשקט — הפעולה עצמה תיכשל עליו ממילא,
    // ואין סיבה להסגיר לעובד אילו מזהים קיימים במערכת
    if (!lead) continue;
    if (lead.assigneeId !== user.id) return FORBIDDEN;
  }
  return null;
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
  const sourceDetail = String(formData.get("sourceDetail") ?? "").trim();
  const packageName = String(formData.get("packageName") ?? "").trim();
  const actorId = await actor();

  await db.leads.create({
    name,
    // ספרות בלבד — הייבוא, העריכה וקצה ה-API כולם מנרמלים כך, והדדופ
    // לפי טלפון הוא השוואת מחרוזות מדויקת. ליד שנשמר כאן כ-
    // "050-123-4567" לא היה מזוהה ככפילות מול אף אחד מהם.
    phone: phone.replace(/\D/g, ""),
    email: email || undefined,
    city: city || undefined,
    note: note || undefined,
    kind: (formData.get("kind") as LeadKind) ?? "data",
    priority: (formData.get("priority") as Priority) ?? "normal",
    category: (category as LeadCategoryKey) || undefined,
    currentProvider: (currentProvider as ProviderKey) || undefined,
    sourceDetail: sourceDetail || undefined,
    packageName: packageName || undefined,
    // ללא בחירה = משויך ליוצר, לא ל"ללא שיוך" — תואם לטופס האמיתי
    assigneeId: assigneeId || actorId,
    source: "manual",
    createdById: actorId,
  });

  revalidateLeadSurfaces();
  return { ok: true };
}

/* ── עריכה ────────────────────────────────────────────────────────────── */

/**
 * עריכת פרטי הליד.
 *
 * מריץ את אותה ולידציה כמו היצירה — אימות בצד הלקוח הוא נוחות, ופה
 * זו נקודת קצה שאפשר לקרוא לה ישירות.
 */
export async function updateLeadAction(
  leadId: string,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await assertCanEdit([leadId]);
  if (denied) return { ok: false, error: denied };

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
  const sourceDetail = String(formData.get("sourceDetail") ?? "").trim();
  const packageName = String(formData.get("packageName") ?? "").trim();

  // `null` ולא `undefined`: שדה ריק בטופס הוא בקשה מפורשת *לנקות*.
  // עם `undefined` הבקשה הזו נבלעה ב-Postgres והמשתמש קיבל טוסט
  // הצלחה על שינוי שלא קרה. ראה UpdateLeadInput.
  await db.leads.update(leadId, {
    name,
    phone: phone.replace(/\D/g, ""),
    email: email || null,
    city: city || null,
    kind: (formData.get("kind") as LeadKind) ?? "data",
    priority: (formData.get("priority") as Priority) ?? "normal",
    category: (category as LeadCategoryKey) || null,
    currentProvider: (currentProvider as ProviderKey) || null,
    sourceDetail: sourceDetail || null,
    packageName: packageName || null,
    // בעריכה "ללא שיוך" הוא בחירה מפורשת, לא ברירת מחדל ליוצר
    assigneeId: assigneeId || null,
  });

  revalidateLeadSurfaces();
  return { ok: true };
}

/* ── עריכה מהירה מתוך השורה ───────────────────────────────────────────── */

/**
 * שינוי שדה בודד ישירות מטבלת הלידים.
 *
 * נפרד מ-`updateLeadAction` בכוונה: זו לא שליחת טופס אלא שינוי של ערך
 * אחד, ולכן היא לא דורשת שם וטלפון תקינים כדי לעבור. שליחת הטופס
 * המלא רק כדי לשנות עדיפות הייתה גם דורסת שדות שהמשתמש לא נגע בהם.
 *
 * `null` מנקה, `undefined` לא נוגע — אותה מוסכמה כמו `UpdateLeadInput`.
 */
export interface LeadPatch {
  priority?: Priority;
  category?: LeadCategoryKey | null;
  kind?: LeadKind;
  /** `null` = הסרת שיוך */
  assigneeId?: string | null;
  /** `YYYY-MM-DD` מ-`<input type="date">`, או `null` לניקוי */
  followUpDate?: string | null;
}

export async function patchLeadAction(
  leadId: string,
  patch: LeadPatch,
): Promise<ActionResult> {
  const denied = await assertCanEdit([leadId]);
  if (denied) return { ok: false, error: denied };

  const actorId = await actor();

  if (patch.priority !== undefined && !isPriority(patch.priority)) {
    return { ok: false, error: "עדיפות לא מוכרת" };
  }
  if (
    patch.category !== undefined &&
    patch.category !== null &&
    !isLeadCategory(patch.category)
  ) {
    return { ok: false, error: "קטגוריה לא מוכרת" };
  }
  if (patch.kind !== undefined && !isLeadKind(patch.kind)) {
    return { ok: false, error: "סוג ליד לא מוכר" };
  }

  // השיוך עובר דרך `assign` ולא דרך `update` — רק הוא רושם את הפעולה
  // ביומן הפעילות של הליד, וזה מה שמאפשר לדעת אחר כך מי העביר למי
  if (patch.assigneeId !== undefined) {
    if (patch.assigneeId) {
      const user = await db.users.getById(patch.assigneeId);
      if (!user) return { ok: false, error: "העובד לא נמצא" };
      if (!user.active) return { ok: false, error: "העובד אינו פעיל" };
    }
    await db.leads.assign([leadId], patch.assigneeId, actorId);
  }

  const update: Parameters<typeof db.leads.update>[1] = {};
  if (patch.priority !== undefined) update.priority = patch.priority;
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.kind !== undefined) update.kind = patch.kind;

  if (patch.followUpDate !== undefined) {
    if (patch.followUpDate === null || patch.followUpDate === "") {
      update.followUpAt = null;
    } else {
      const parsed = parseFollowUpDate(patch.followUpDate);
      if (!parsed) return { ok: false, error: "תאריך החזרה לא תקין" };
      update.followUpAt = parsed;
    }
  }

  if (Object.keys(update).length > 0) {
    await db.leads.update(leadId, update);
  }

  revalidateLeadSurfaces();
  return { ok: true };
}

/* ── שינוי סטטוס ──────────────────────────────────────────────────────── */

export interface BulkStatusResult {
  updated: number;
  /** לידים שנכשלו — בדרך כלל נמחקו ע"י מישהו אחר בינתיים */
  failed: number;
}

/**
 * שינוי סטטוס לקבוצת לידים.
 *
 * ⚠️ הגרסה הקודמת רצה בלולאה **בלקוח** ועצרה בכישלון הראשון: מתוך 20
 * לידים, 6 כבר שונו, 14 לא, והמשתמש ראה רק הודעת שגיאה עם הדיאלוג
 * פתוח — כך שניסיון חוזר שכתב את ההיסטוריה של הראשונים פעם שנייה.
 *
 * כאן הוולידציה רצה פעם אחת, הלולאה בשרת, וכישלון בליד בודד לא עוצר
 * את השאר. הריענון קורה פעם אחת בסוף במקום N פעמים.
 */
export async function changeStatusManyAction(
  leadIds: string[],
  to: LeadStatus,
  detail?: string,
  followUpDate?: string,
): Promise<ActionResult<BulkStatusResult>> {
  if (leadIds.length === 0) return { ok: false, error: "לא נבחרו לידים" };

  const denied = await assertCanEdit(leadIds);
  if (denied) return { ok: false, error: denied };

  if (!isLeadStatus(to)) return { ok: false, error: "סטטוס לא מוכר" };
  const meta = STATUS_CONFIG[to];

  if (meta.prompt?.required && !detail?.trim()) {
    return { ok: false, error: `${meta.prompt.question} — שדה חובה` };
  }

  let followUpAt: string | undefined;
  if (followUpDate) {
    const parsed = parseFollowUpDate(followUpDate);
    if (!parsed) return { ok: false, error: "תאריך החזרה לא תקין" };
    followUpAt = parsed;
  }

  const actorId = await actor();
  const trimmed = detail?.trim() || undefined;

  let updated = 0;
  let failed = 0;
  for (const leadId of leadIds) {
    try {
      await db.leads.changeStatus({
        leadId,
        to,
        detail: trimmed,
        actorId,
        followUpAt,
      });
      updated += 1;
    } catch {
      // ליד שנמחק בינתיים לא צריך להפיל את השאר
      failed += 1;
    }
  }

  if (updated === 0) {
    return { ok: false, error: "אף ליד לא עודכן — ייתכן שהלידים נמחקו" };
  }

  revalidateLeadSurfaces();
  return { ok: true, data: { updated, failed } };
}

export async function changeStatusAction(
  leadId: string,
  to: LeadStatus,
  detail?: string,
  followUpDate?: string,
): Promise<ActionResult> {
  const denied = await assertCanEdit([leadId]);
  if (denied) return { ok: false, error: denied };

  // `STATUS_CONFIG[to]` לבדו היה עובר גם עבור "constructor"/"toString"
  if (!isLeadStatus(to)) return { ok: false, error: "סטטוס לא מוכר" };
  const meta = STATUS_CONFIG[to];

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

  revalidateLeadSurfaces();
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

  // שיוך הוא פעולה ניהולית: עובד לא משייך לעצמו ליד מהמאגר ולא
  // מעביר ליד לעמית. `assertCanEdit` מתיר לו רק לידים שכבר שלו.
  const denied = await assertCanEdit(leadIds);
  if (denied) return { ok: false, error: denied };

  if (assigneeId) {
    const user = await db.users.getById(assigneeId);
    if (!user) return { ok: false, error: "העובד לא נמצא" };
    if (!user.active) return { ok: false, error: "העובד אינו פעיל" };
  }

  await db.leads.assign(leadIds, assigneeId, await actor());
  revalidateLeadSurfaces();
  return { ok: true };
}

/* ── עלות וכוכב ───────────────────────────────────────────────────────── */

/**
 * עלות פרטנית לליד.
 *
 * `null` מנקה אותה ומחזיר לעלות של הקטגוריה; `0` הוא ערך אמיתי
 * שמשמעותו "הליד היה חינם". שני מצבים שונים, ולכן שני ערכים שונים.
 */
export async function setLeadCostAction(
  leadId: string,
  cost: number | null,
): Promise<ActionResult> {
  const denied = await assertCanEdit([leadId]);
  if (denied) return { ok: false, error: denied };

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

  revalidateLeadSurfaces();
  return { ok: true };
}

export async function toggleStarAction(
  leadId: string,
  next: boolean,
): Promise<ActionResult> {
  const denied = await assertCanEdit([leadId]);
  if (denied) return { ok: false, error: denied };

  await db.leads.update(leadId, { isStarred: next });
  await db.leads.logActivity({
    leadId,
    type: next ? "starred" : "unstarred",
    actorId: await actor(),
  });

  revalidateLeadSurfaces();
  return { ok: true };
}

/* ── הערות ────────────────────────────────────────────────────────────── */

export async function addNoteAction(
  leadId: string,
  body: string,
): Promise<ActionResult> {
  const denied = await assertCanEdit([leadId]);
  if (denied) return { ok: false, error: denied };

  const text = body.trim();
  if (!text) return { ok: false, error: "ההערה ריקה" };

  await db.leads.addNote(leadId, await actor(), text);
  revalidateLeadSurfaces();
  return { ok: true };
}

/* ── מחיקה ────────────────────────────────────────────────────────────── */

export async function deleteLeadsAction(
  leadIds: string[],
): Promise<ActionResult> {
  if (leadIds.length === 0) return { ok: false, error: "לא נבחרו לידים" };

  const denied = await assertCanEdit(leadIds);
  if (denied) return { ok: false, error: denied };

  await db.leads.remove(leadIds);
  revalidateLeadSurfaces();
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
  /** עמודת "מקור" בקובץ — שם הקמפיין */
  sourceDetail?: string;
  /** עמודת "חבילה" בקובץ */
  packageName?: string;
  /** עמודת "ספק"/"שם חברה" בקובץ, או מה שנחלץ משם החבילה */
  currentProvider?: ProviderKey;
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

  // הקלט מגיע מהלקוח, ולכן `category`/`kind` נאמתים כאן ולא רק
  // בפרסור הקובץ — ערך לא חוקי היה עובר ישר ל-DB
  const valid = rows.filter(
    (r) =>
      r.name?.trim().length >= 2 &&
      isIsraeliPhone(r.phone ?? "") &&
      (r.category === undefined || isLeadCategory(r.category)) &&
      (r.kind === undefined || isLeadKind(r.kind)) &&
      (r.currentProvider === undefined || isProvider(r.currentProvider)),
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
      sourceDetail: r.sourceDetail?.trim() || undefined,
      packageName: r.packageName?.trim() || undefined,
      currentProvider: r.currentProvider,
      category: r.category,
      kind: r.kind ?? "data",
      priority: "normal" as const,
      source: "import" as const,
      createdById: actorId,
    })),
  );

  revalidateLeadSurfaces();
  return {
    ok: true,
    data: { imported: fresh.length, skipped, duplicates },
  };
}
