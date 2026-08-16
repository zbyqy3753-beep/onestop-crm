import { LiveDashboardClient } from "@/components/live-dashboard/LiveDashboardClient";
import { requireStaffUser } from "@/server/auth/session";

/**
 * עטיפת Server Component דקה — הדשבורד עצמו לגמרי client-side
 * (זקוק ל-`useNow()` לחותמת הרעננות), אבל השארת נקודת הכניסה
 * כ-Server Component שומרת על המוסכמה `page.tsx` בשאר המסכים.
 */
export default async function DealsDashboardPage() {
  // הפכה ל-async רק בשביל השער. הדשבורד עצמו נשאר client-side.
  await requireStaffUser();

  return <LiveDashboardClient />;
}
