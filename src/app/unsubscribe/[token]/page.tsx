import { optOutByToken } from "@/server/mailer/optOut";

/**
 * דף ההסרה מרשימת התפוצה.
 *
 * ⚠️ **ההסרה מתבצעת בעצם הפתיחה, בלי כפתור אישור.** מסך ביניים הוא
 * חיכוך, וחיכוך בהסרה הוא בדיוק מה שגורם לאנשים ללחוץ "דווח כספאם"
 * במקום. אין כאן מה לאשר: הטוקן חתום, והפעולה הפיכה בפנייה אלינו.
 */

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const email = await optOutByToken(token, "קישור ההסרה במייל");

  return (
    <main
      dir="rtl"
      className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center"
    >
      {email ? (
        <>
          <h1 className="text-2xl font-semibold">הוסרת מרשימת התפוצה</h1>
          <p className="text-ink-2">
            לא נשלח יותר דיוור אל {email}. אם זו הייתה טעות, השב לאחד
            המיילים שקיבלת ונחזיר אותך.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold">הקישור אינו תקף</h1>
          <p className="text-ink-2">
            ייתכן שהוא נחתך בהעתקה. השב לאחד המיילים שקיבלת ונסיר אותך
            ידנית.
          </p>
        </>
      )}
    </main>
  );
}
