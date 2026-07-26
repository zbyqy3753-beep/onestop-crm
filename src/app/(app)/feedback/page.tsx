import { FeedbackClient } from "@/components/feedback/FeedbackClient";
import { feedbackStore } from "@/server/feedback";

/**
 * משוב בודקים על המערכת עצמה — המסך היחיד שנוגע ב-Firebase.
 * נתוני ה-CRM (לידים/עסקאות/חבילות) לא מגיעים לכאן.
 */
/**
 * דינמי במפורש: ברירת המחדל הייתה מקבעת את הרשימה לזמן הבנייה,
 * וכל משוב חדש (בעיקר מ-Firestore, שנכתב מחוץ לתהליך) לא היה מופיע.
 */
export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const items = await feedbackStore.list();
  return <FeedbackClient items={items} />;
}
