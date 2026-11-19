import "server-only";

import { createHash } from "node:crypto";
import { db } from "@/server/repositories";
import type { Role } from "@/lib/domain/types";

/**
 * ── מי יכול להחזיק QR אישי של סניף ─────────────────────────────────
 *
 * ליד מ-QR אישי (`<סניף>--<תג>`, ראה `lib/domain/branches.ts`) משויך
 * לנציג שהתג שלו. התג נגזר ממזהה המשתמש ולא נשמר ב-DB: אותו עובד מקבל
 * תמיד אותו תג, ומדבקה שהודפסה ממשיכה לעבוד.
 *
 * ⚠️ שמונה תווי hex = ארבעה מיליארד ערכים. התנגשות בין שני עובדים
 * כמעט בלתי אפשרית, ו-`repByTag` מחזיר `undefined` אם בכל זאת קרתה,
 * כדי שליד לא ינחת אצל העובד הלא נכון.
 */
const TAG_LENGTH = 8;

/** תפקידים שלא מטפלים בלידים, ולכן אין להם QR אישי. */
const NOT_REPS: readonly Role[] = ["supplier", "siteManager"];

export function repTag(userId: string): string {
  return createHash("sha256")
    .update(`branch-rep:${userId}`)
    .digest("hex")
    .slice(0, TAG_LENGTH);
}

export type BranchRep = { id: string; name: string; tag: string };

/** העובדים הפעילים שיכולים לקבל QR אישי, לפי שם. */
export async function branchReps(): Promise<BranchRep[]> {
  const users = await db.users.listActive();
  return users
    .filter((u) => !NOT_REPS.includes(u.role))
    .map((u) => ({ id: u.id, name: u.name, tag: repTag(u.id) }))
    .sort((a, b) => a.name.localeCompare(b.name, "he"));
}

/**
 * העובד הפעיל שהתג שלו, או `undefined`.
 *
 * ⚠️ עובד שהושבת מחזיר `undefined`: ליד ששויך לעובד מושבת היה מוסתר
 * מכולם חוץ מההנהלה. המדבקה שלו ממשיכה להביא לידים עם שם הסניף.
 */
export async function repByTag(tag: string): Promise<BranchRep | undefined> {
  const matches = (await branchReps()).filter((r) => r.tag === tag);
  return matches.length === 1 ? matches[0] : undefined;
}
