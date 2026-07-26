import type { CreateFeedbackInput, Feedback } from "@/lib/domain/feedback";

/**
 * הממשק שמאחוריו מתחלפים המימושים (זיכרון / Firestore).
 * מראה מכוונת של `Repositories` — אותה הפרדה, בקנה מידה קטן.
 */
export interface FeedbackStore {
  /** החדש ראשון */
  list(): Promise<Feedback[]>;
  create(input: CreateFeedbackInput): Promise<Feedback>;
}
