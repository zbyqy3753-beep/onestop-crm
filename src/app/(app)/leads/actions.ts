"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/repositories";
import { CURRENT_USER_ID } from "@/lib/domain/seed";
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
 * ⚠️ אין כאן עדיין בדיקת הרשאות. `actorId` נלקח מקבוע במקום
 * מ-session. בחיבור auth, כל פעולה חייבת להתחיל ב:
 *     const session = await auth();
 *     if (!session) return { ok: false, error: "אין הרשאה" };
 * ולהשתמש ב-session.user.id במקום ב-CURRENT_USER_ID.
 */

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function actor(): string {
  return CURRENT_USER_ID;
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
    assigneeId: assigneeId || actor(),
    source: "manual",
    createdById: actor(),
  });

  revalidatePath("/leads");
  return { ok: true };
}

/* ── שינוי סטטוס ──────────────────────────────────────────────────────── */

export async function changeStatusAction(
  leadId: string,
  to: LeadStatus,
  detail?: string,
): Promise<ActionResult> {
  const meta = STATUS_CONFIG[to];
  if (!meta) return { ok: false, error: "סטטוס לא מוכר" };

  // הפירוט הוא מה שהופך את ההיסטוריה לשימושית — נאכף בשרת, לא רק בטופס
  if (meta.prompt?.required && !detail?.trim()) {
    return { ok: false, error: `${meta.prompt.question} — שדה חובה` };
  }

  await db.leads.changeStatus({
    leadId,
    to,
    detail: detail?.trim() || undefined,
    actorId: actor(),
  });

  revalidatePath("/leads");
  return { ok: true };
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

  await db.leads.assign(leadIds, assigneeId);
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

  await db.leads.addNote(leadId, actor(), text);
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
}

export async function importLeadsAction(
  rows: ImportRow[],
): Promise<ActionResult<{ imported: number; skipped: number }>> {
  const valid = rows.filter(
    (r) => r.name?.trim().length >= 2 && isIsraeliPhone(r.phone ?? ""),
  );

  if (valid.length === 0) {
    return { ok: false, error: "לא נמצאו שורות תקינות בקובץ" };
  }

  await db.leads.createMany(
    valid.map((r) => ({
      name: r.name.trim(),
      phone: r.phone.replace(/\D/g, ""),
      email: r.email?.trim() || undefined,
      city: r.city?.trim() || undefined,
      kind: "data" as const,
      priority: "normal" as const,
      source: "import" as const,
      createdById: actor(),
    })),
  );

  revalidatePath("/leads");
  return {
    ok: true,
    data: { imported: valid.length, skipped: rows.length - valid.length },
  };
}
