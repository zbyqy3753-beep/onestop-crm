"use server";

import { revalidatePath } from "next/cache";
import { GENERAL_SCREEN, isFeedbackKind } from "@/lib/domain/feedback";
import { feedbackStore } from "@/server/feedback";

export interface FeedbackFormState {
  ok: boolean;
  error?: string;
}

export async function submitFeedback(
  _prev: FeedbackFormState | null,
  formData: FormData,
): Promise<FeedbackFormState> {
  const kind = formData.get("kind");
  const body = String(formData.get("body") ?? "").trim();
  const reporter = String(formData.get("reporter") ?? "").trim();
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
    reporter: reporter || "אנונימי",
  });

  revalidatePath("/feedback");
  return { ok: true };
}
