import "server-only";

import type { CreateFeedbackInput, Feedback } from "@/lib/domain/feedback";
import type { FeedbackStore } from "./types";

/**
 * מימוש בזיכרון — ברירת המחדל.
 *
 * הנתונים נעלמים בכל הפעלה מחדש של השרת. זה מכוון: הוא קיים כדי
 * שאפשר יהיה לפתח ולבדוק את המסך בלי Firebase בכלל.
 */
const rows: Feedback[] = [];

let counter = 0;

export const memoryFeedbackStore: FeedbackStore = {
  async list() {
    return [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async create(input: CreateFeedbackInput) {
    const row: Feedback = {
      ...input,
      id: `fb_${++counter}`,
      createdAt: new Date().toISOString(),
    };
    rows.push(row);
    return row;
  },
};
