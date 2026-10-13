"use server";

import { db } from "@/server/repositories";
import { actorForRoute } from "@/server/auth/session";
import { createAuthUser } from "@/server/auth/supabaseAdmin";
import { authErrorInHebrew } from "@/server/auth/authErrors";
import { canJoinTeam } from "@/lib/domain/permissions";
import { isRole, type Role } from "@/lib/domain/types";
import { isIsraeliPhone } from "@/lib/format";
import { passwordProblem } from "@/lib/password";
import { isValidLoginId, toLoginEmail } from "@/lib/loginId";
import { revalidateUserSurfaces } from "@/app/(app)/_revalidate";

/**
 * פעולות "הצוות שלי" — בעל עסק מנהל את העובדים המשויכים אליו.
 *
 * ⚠️ כל פעולה בודקת בעצמה דרך `actorForRoute("/team")`: Server Action
 * היא נקודת קצה HTTP, והשומר על המסך לא שומר עליה.
 */

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const FORBIDDEN = "רק בעל עסק יכול לנהל צוות";

/**
 * יצירת עובד חדש שמשויך מיד לבעל העסק שיצר אותו.
 *
 * ⚠️ התפקיד מוגבל ל-`TEAM_MEMBER_ROLES` ונבדק כאן ולא רק בבורר: בלעדי
 * זה בעל עסק היה יכול להנפיק לעצמו חשבון מנהל בקריאה ישירה.
 * ⚠️ `teamOwnerId` נלקח מהסשן ולא מהטופס — אי אפשר לשייך לאחר.
 */
export async function createTeamMemberAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await actorForRoute("/team");
  if (!actor) return { ok: false, error: FORBIDDEN };

  const name = String(formData.get("name") ?? "").trim();
  const rawLoginId = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const rawRole = String(formData.get("role") ?? "employee");
  const password = String(formData.get("password") ?? "");

  if (name.length < 2) return { ok: false, error: "שם מלא הוא שדה חובה" };
  if (!isValidLoginId(rawLoginId)) {
    return {
      ok: false,
      error: "שם משתמש לא תקין — אותיות באנגלית, ספרות, נקודה או מקף",
    };
  }
  const email = toLoginEmail(rawLoginId);
  if (phone && !isIsraeliPhone(phone)) {
    return { ok: false, error: "מספר טלפון לא תקין" };
  }
  if (!isRole(rawRole) || !canJoinTeam(rawRole)) {
    return { ok: false, error: "אפשר לצרף לצוות עובד, סוכן או מתפעל בלבד" };
  }
  const role: Role = rawRole;
  const weak = passwordProblem(password);
  if (weak) return { ok: false, error: weak };

  const existing = await db.users.getByEmail(email);
  if (existing) return { ok: false, error: "כבר קיים משתמש עם שם המשתמש הזה" };

  try {
    await createAuthUser(email, password);
  } catch (e) {
    return { ok: false, error: authErrorInHebrew(e, email) };
  }

  await db.users.create({
    name,
    email,
    phone: phone ? phone.replace(/\D/g, "") : undefined,
    // העובד יושב באותו עסק — החנות עוברת בירושה מבעל העסק
    store: actor.store,
    role,
    teamOwnerId: actor.id,
  });

  revalidateUserSurfaces();
  return { ok: true };
}

/**
 * ניתוק עובד מהצוות. החשבון עצמו נשאר — רק השיוך מתנקה, ובעל העסק
 * מפסיק לראות את הלידים שלו.
 *
 * ⚠️ רק עובד שמשויך **אליו**. מזהה של עובד אחר נדחה באותה הודעה כמו
 * מזהה שאינו קיים — אין סיבה לאשר לבעל עסק אילו מזהים קיימים.
 */
export async function detachTeamMemberAction(
  userId: string,
): Promise<ActionResult> {
  const actor = await actorForRoute("/team");
  if (!actor) return { ok: false, error: FORBIDDEN };

  const member = await db.users.getById(userId);
  if (!member || member.teamOwnerId !== actor.id) {
    return { ok: false, error: "העובד לא נמצא בצוות שלך" };
  }

  await db.users.update(userId, { teamOwnerId: null });
  revalidateUserSurfaces();
  return { ok: true };
}
