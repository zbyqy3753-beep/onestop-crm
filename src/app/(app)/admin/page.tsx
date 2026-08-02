import { notFound } from "next/navigation";
import { AdminClient } from "@/components/admin/AdminClient";
import { db } from "@/server/repositories";
import { requireSessionUser } from "@/server/auth/session";

/**
 * רכיב שרת. שולף דרך שכבת ה-repository בלבד ומעביר למטה.
 *
 * ⚠️ המסך הזה חושף את כל המשתמשים בארגון ומאפשר ליצור משתמש חדש.
 * עד עכשיו לא הייתה בו שום בדיקה — גם לא `requireSessionUser` — כך
 * שכל מי שהגיע לכתובת ראה את הרשימה. הסתרת הפריט מהתפריט ב-`nav.ts`
 * היא הסתרה, לא הרשאה: הנתיב עצמו היה נגיש בהקלדה ישירה.
 *
 * `notFound()` ולא הפניה — מי שאין לו הרשאה לא צריך ללמוד שהמסך קיים.
 */
const ALLOWED = ["owner", "manager"] as const;

export default async function AdminPage() {
  const actor = await requireSessionUser();
  if (!ALLOWED.includes(actor.role as (typeof ALLOWED)[number])) notFound();

  const [users, { rows: leads }] = await Promise.all([
    db.users.list(),
    db.leads.list(),
  ]);

  return (
    <AdminClient
      users={users}
      leads={leads}
      canImpersonate={actor.role === "owner"}
      currentUserId={actor.id}
    />
  );
}
