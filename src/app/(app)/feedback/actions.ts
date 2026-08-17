"use server";

import { revalidatePath } from "next/cache";
import { GENERAL_SCREEN, isFeedbackKind } from "@/lib/domain/feedback";
import { feedbackStore } from "@/server/feedback";
import { requireStaffUser } from "@/server/auth/session";

export interface FeedbackFormState {
  ok: boolean;
  error?: string;
}

/**
 * ⚠️ שתי תקלות היו כאן, ושתיהן נובעות מאותה הנחה — ש"רק מי שהמסך
 * פתוח בפניו קורא לפונקציה":
 *
 * 1. לא הייתה שום קריאת אימות. `submitFeedback` היא נקודת קצה HTTP,
 *    וכל מי שהגיע ל-origin יכול היה למלא את מאגר המשוב.
 * 2. `reporter` הגיע מגוף הטופס — כלומר גם משתמש מחובר יכול היה
 *    לחתום בשם עובד אחר. שדה זהות שהלקוח שולח אינו זהות.
 *
 * `requireStaffUser` ולא `requireSessionUser`: מסך המשוב עצמו סגור
 * בפני ספק חיצוני, והפעולה צריכה להסכים איתו.
 */
export async function submitFeedback(
  _prev: FeedbackFormState | null,
  formData: FormData,
): Promise<FeedbackFormState> {
  const user = await requireStaffUser();

  const kind = formData.get("kind");
  const body = String(formData.get("body") ?? "").trim();
  const screen = String(formData.get("screen") ?? GENERAL_SCREEN);
  const rating = Number(formData.get("rating"));

  if (!isFeedbackKind(kind)) return { ok: false, error: "בחר סוג משוב." };
  if (!body) return { ok: false, error: "יש לכתוב תיאור." };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "בחר דירוג בין 1 ל-5." };
  }

  await feedbackStore.create({
    kind,
    screen,
    rating,
    body,
    // הזהות מהסשן. "אנונימי" לא קיים יותר: משוב פנימי מזוהה תמיד,
    // וברירת המחדל האנונימית רק הסתירה את זה שאיש לא אימת את השם.
    reporter: user.name,
  });

  revalidatePath("/feedback");
  return { ok: true };
}
