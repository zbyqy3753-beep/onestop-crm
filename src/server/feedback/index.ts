import "server-only";

import { memoryFeedbackStore } from "./memory";
import type { FeedbackStore } from "./types";

export type * from "./types";

/**
 * נקודת הכניסה היחידה לאחסון המשוב.
 *
 * כרגע האחסון בזיכרון בלבד — נמחק בכל הפעלה מחדש של השרת. זה
 * מספיק לגרסת בדיקה: הבודקים משאירים משוב ורואים אותו מיד.
 *
 * אם בעתיד תרצה אחסון קבוע (Firestore/DB), זו הנקודה שבה מוסיפים
 * מימוש נוסף מאחורי `FeedbackStore` ובוחרים אותו לפי משתנה סביבה,
 * בדיוק כמו `DATA_SOURCE` ב-`repositories/index.ts`.
 */
export const feedbackStore: FeedbackStore = memoryFeedbackStore;
