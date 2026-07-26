import { LiveDashboardClient } from "@/components/live-dashboard/LiveDashboardClient";

/**
 * עטיפת Server Component דקה — הדשבורד עצמו לגמרי client-side
 * (זקוק ל-`useNow()` לחותמת הרעננות), אבל השארת נקודת הכניסה
 * כ-Server Component שומרת על המוסכמה `page.tsx` בשאר המסכים.
 */
export default function DealsDashboardPage() {
  return <LiveDashboardClient />;
}
