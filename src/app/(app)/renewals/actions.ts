"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/client";
import { requireSessionUser } from "@/server/auth/session";
import { extractPdfText } from "@/server/renewals/extract";
import { deletePdf, storagePathFor, uploadPdf } from "@/server/renewals/storage";
import type { ActionResult } from "@/app/(app)/admin/actions";

/**
 * העלאת מסמכי חידוש.
 *
 * ⚠️ כל פעולה בודקת הרשאה בעצמה. server action היא נקודת קצה HTTP
 * לכל דבר — הסתרת המסך מהתפריט או `notFound()` ב-page.tsx חוסמים
 * רינדור, לא קריאה ישירה.
 */
const ALLOWED = ["owner", "manager"] as const;

async function requireManager(): Promise<{ id: string } | null> {
  const actor = await requireSessionUser();
  if (!ALLOWED.includes(actor.role as (typeof ALLOWED)[number])) return null;
  return { id: actor.id };
}

/** 10MB — תואם למגבלת הדלי ולמגבלת גוף ה-action ב-next.config. */
const MAX_BYTES = 10 * 1024 * 1024;

export interface UploadOutcome {
  fileName: string;
  ok: boolean;
  /** הסיבה, כשלא הצליח או כשהקובץ כבר קיים */
  note?: string;
}

/**
 * מעלה קובץ אחד או יותר.
 *
 * מחזיר תוצאה **לכל קובץ בנפרד** ולא נכשל כולו על קובץ אחד: מעלים
 * כאן עשרות חשבוניות בבת אחת, ואם אחת מהן סרוקה זו סיבה לדווח עליה,
 * לא לזרוק את כל האצווה.
 */
export async function uploadRenewalDocsAction(
  formData: FormData,
): Promise<ActionResult<UploadOutcome[]>> {
  const actor = await requireManager();
  if (!actor) return { ok: false, error: "אין לך הרשאה להעלות מסמכים" };

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return { ok: false, error: "לא נבחרו קבצים" };

  const results: UploadOutcome[] = [];

  for (const file of files) {
    const outcome = await ingestOne(file, actor.id);
    results.push(outcome);
  }

  revalidatePath("/renewals");
  return { ok: true, data: results };
}

async function ingestOne(file: File, actorId: string): Promise<UploadOutcome> {
  const fileName = file.name || "ללא שם";

  if (file.size === 0) return { fileName, ok: false, note: "הקובץ ריק" };
  if (file.size > MAX_BYTES) {
    return { fileName, ok: false, note: "הקובץ גדול מ-10MB" };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // ⚠️ הבדיקה על התוכן ולא על הסיומת או על `file.type`: שניהם מגיעים
  // מהדפדפן וניתנים לזיוף, ו-`%PDF` הוא מה ש-pdf.js באמת ידרוש
  const magic = new TextDecoder().decode(bytes.slice(0, 5));
  if (!magic.startsWith("%PDF")) {
    return { fileName, ok: false, note: "לא קובץ PDF" };
  }

  const hash = createHash("sha256").update(bytes).digest("hex");

  const existing = await prisma.renewalDocument.findUnique({
    where: { contentHash: hash },
    select: { fileName: true },
  });
  if (existing) {
    // לא שגיאה — זה בדיוק מה שהמנגנון נועד למנוע, והמשתמש צריך לדעת
    // שהמסמך כבר במערכת ולא שההעלאה נכשלה
    return { fileName, ok: true, note: `כבר קיים במערכת (${existing.fileName})` };
  }

  const path = storagePathFor(hash);

  try {
    await uploadPdf(path, bytes);
  } catch (e) {
    return {
      fileName,
      ok: false,
      note: e instanceof Error ? e.message : "שמירת הקובץ נכשלה",
    };
  }

  // החילוץ אחרי ההעלאה: קובץ שנשמר וטרם חולץ הוא מצב שאפשר לתקן
  // (חילוץ חוזר), אבל טקסט בלי הקובץ שממנו הגיע הוא מבוי סתום
  let text: string | null = null;
  let pageCount: number | null = null;
  let error: string | null = null;

  try {
    const res = await extractPdfText(bytes);
    text = res.text;
    pageCount = res.pageCount;
  } catch (e) {
    error = e instanceof Error ? e.message : "החילוץ נכשל";
  }

  try {
    await prisma.renewalDocument.create({
      data: {
        fileName,
        byteSize: file.size,
        storagePath: path,
        contentHash: hash,
        status: error ? "failed" : "extracted",
        extractedText: text,
        pageCount,
        error,
        uploadedById: actorId,
      },
    });
  } catch (e) {
    // ⚠️ השורה נכשלה אחרי שהקובץ כבר בדלי. בלי הניקוי הזה הדלי צובר
    // קבצים יתומים שאף שורה לא מצביעה עליהם, ואין דרך לזהות אותם חוץ
    // מהשוואה ידנית מול המסד.
    await deletePdf(path).catch(() => {});
    return {
      fileName,
      ok: false,
      note: e instanceof Error ? e.message : "שמירת הרשומה נכשלה",
    };
  }

  return {
    fileName,
    ok: !error,
    note: error ?? undefined,
  };
}

/** מוחק מסמך — גם השורה וגם הקובץ בדלי. */
export async function deleteRenewalDocAction(
  id: string,
): Promise<ActionResult> {
  const actor = await requireManager();
  if (!actor) return { ok: false, error: "אין לך הרשאה למחוק מסמכים" };

  const doc = await prisma.renewalDocument.findUnique({
    where: { id },
    select: { storagePath: true },
  });
  if (!doc) return { ok: false, error: "המסמך לא נמצא" };

  await prisma.renewalDocument.delete({ where: { id } });
  // הקובץ אחרי השורה: קובץ יתום בדלי הוא בזבוז מקום, אבל שורה
  // שמצביעה על קובץ מחוק היא שגיאה במסך
  await deletePdf(doc.storagePath).catch(() => {});

  revalidatePath("/renewals");
  return { ok: true };
}
