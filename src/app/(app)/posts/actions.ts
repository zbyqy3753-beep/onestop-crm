"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/client";
import { requireStaffUser } from "@/server/auth/session";

export interface PostRequestFormState {
  ok: boolean;
  error?: string;
}

const TOPIC_MAX = 300;
const NOTES_MAX = 1500;

/**
 * בקשה לפוסט שמשימת Claude המתוזמנת תכין ותפרסם.
 *
 * המבקש נלקח מהסשן ולא מהטופס, מאותה סיבה שב-`submitFeedback`: שדה
 * זהות שהלקוח שולח אינו זהות.
 */
export async function createPostRequest(
  _prev: PostRequestFormState | null,
  formData: FormData,
): Promise<PostRequestFormState> {
  const user = await requireStaffUser();

  const topic = String(formData.get("topic") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!topic) return { ok: false, error: "כתוב על מה הפוסט." };
  if (topic.length > TOPIC_MAX) return { ok: false, error: `הנושא ארוך מ-${TOPIC_MAX} תווים.` };
  if (notes.length > NOTES_MAX) return { ok: false, error: `ההערות ארוכות מ-${NOTES_MAX} תווים.` };

  await prisma.postRequest.create({
    data: { topic, notes: notes || null, createdById: user.id },
  });

  revalidatePath("/posts");
  return { ok: true };
}
