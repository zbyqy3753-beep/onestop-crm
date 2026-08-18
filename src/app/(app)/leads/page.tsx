import { LeadsClient } from "@/components/leads/LeadsClient";
import { SupplierLeadsList } from "@/components/leads/SupplierLeadsList";
import { db } from "@/server/repositories";
import { requireSessionUser } from "@/server/auth/session";
import {
  canManageSettings,
  canSeeAllLeads,
  canUseCrm,
  isSupplier,
} from "@/lib/domain/permissions";
import type { UserRef } from "@/lib/domain/types";
import type { LeadFilter } from "@/server/repositories";
import { periodFromParams } from "@/lib/domain/period";
import { PeriodPicker } from "@/components/leads/PeriodPicker";

/**
 * רכיב שרת. שולף דרך שכבת ה-repository בלבד ומעביר למטה.
 *
 * ⚠️ **הגבלת הצפייה נעשית כאן, בשליפה עצמה — לא בסינון בצד הלקוח.**
 * עובד שאינו מנהל מקבל מהשרת רק את הלידים שמשויכים אליו, כך שלידים
 * של אחרים לא מגיעים לדפדפן שלו בכלל. סינון בלקוח היה משאיר אותם
 * ב-payload של הדף וניתנים לקריאה לכל מי שפותח כלי פיתוח.
 *
 * אותו מסנן מוזרק גם ל-`countByStatus`, אחרת הקוביות היו מונות את
 * כל הארגון בזמן שהטבלה מציגה חתך אישי — שני מספרים סותרים במסך אחד.
 */
export default async function LeadsPage({
  searchParams,
}: {
  // ⚠️ Promise — ב-Next 16 `searchParams` א-סינכרוני. ראה
  // node_modules/next/dist/docs (מדריך הגרסה) לפני שינוי החתימה.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const currentUser = await requireSessionUser();

  /*
   * ── ספק לידים חיצוני ──────────────────────────────────────────────
   *
   * מסלול נפרד לגמרי, ולא `LeadsClient` עם props מוגבלים. `LeadsClient`
   * הוא רכיב לקוח שמקבל את הלידים המלאים ואיתם משתמשים, עלויות רכישה,
   * עסקאות וחבילות — כלומר גם אם היינו מסתירים כל פקד, כל אלה היו
   * יושבים ב-payload של הדף וקריאים לכל מי שפותח DevTools. prop אחד
   * שנשכח בעוד שנה מחזיר את הדליפה בשקט.
   *
   * כאן במקום זה נשלפים רק הלידים שלו, וממופים **בשרת** לשם, טלפון,
   * סטטוס, הערות ותאריך — ותו לא — לפני שמשהו עוזב אותו.
   */
  if (isSupplier(currentUser.role)) {
    /*
     * בלי `leadSourceName` אין שום דרך לדעת אילו לידים שלו — ורשימה
     * ריקה היא התשובה הנכונה. ההיפך (סינון ריק = "החזר הכול") היה
     * מציג לספק את כל מאגר הלידים של הארגון.
     */
    const sourceName = currentUser.leadSourceName?.trim();
    /*
     * מיון מפורש לפי `createdAt` ולא ברירת המחדל (`updatedAt`): המסך
     * מציג את תאריך **הקליטה**, ומיון לפי עדכון אחרון היה מקפיץ לראש
     * ליד בן חודש רק משום שעובד נגע בו הבוקר — רשימה שנראית מעורבבת
     * למי שרואה רק את התאריך השני.
     */
    const rows = sourceName
      ? (
          await db.leads.list({ sourceDetail: sourceName }, {
            field: "createdAt",
            direction: "desc",
          })
        ).rows
      : [];

    return (
      <SupplierLeadsList
        supplierName={currentUser.name}
        rows={rows.map((lead, i) => ({
          // מזהה הליד עצמו לא נשלח: הוא המפתח לכל Server Action על
          // הליד, ולספק אין שום פעולה לבצע. הרשימה מרונדרת בשרת ולא
          // ממוינת מחדש בלקוח, ולכן אינדקס הוא מפתח תקף — ובניגוד
          // לשם+תאריך, הוא ייחודי גם לשני לידים זהים באותו יום.
          key: String(i),
          name: lead.name,
          phone: lead.phone,
          status: lead.status,
          createdAt: lead.createdAt,
          /*
           * ⚠️ ההערות עוברות שדה-שדה ולא כ-`lead.notes`. `LeadNote`
           * נושא `id`, `leadId` ו-`authorId`, ושלושתם מזהים פנימיים
           * שאין לספק מה לעשות איתם — ופיזור (`...note`) היה מצרף
           * גם כל שדה שיתווסף לטיפוס בעתיד, בלי שאיש ישים לב.
           */
          notes: [...lead.notes]
            /*
             * מיון מפורש: ה-`include` של `list` מביא את ההערות בלי
             * `orderBy`, כלומר Postgres מחזיר אותן בסדר בלתי מוגדר.
             * שרשור הערות שמוצג לא לפי סדר הזמן קורא כשיחה מבולבלת.
             */
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
            .map((note) => ({
              body: note.body,
              createdAt: note.createdAt,
            })),
        }))}
      />
    );
  }

  /*
   * עובד רואה **אך ורק** לידים שמשויכים אליו — גם לא לידים ללא שיוך.
   *
   * המשמעות התפעולית: חלוקת הלידים היא באחריות ההנהלה בלבד. ליד
   * שנכנס מה-API ולא שויך אוטומטית יושב במאגר וגלוי רק למנהלים, עד
   * שמישהו מהם משייך אותו. עובד לא לוקח לעצמו לידים.
   */
  const scope: LeadFilter = canSeeAllLeads(currentUser.role)
    ? {}
    : { assigneeId: [currentUser.id] };

  /*
   * ── חתך התקופה ────────────────────────────────────────────────────
   *
   * ⚠️ מוחל על `scoped` שעובר גם ל-`list` וגם ל-`countByStatus`, ולכן
   * הריבועים והטבלה חתוכים זהה. ראה lib/domain/period.ts
   */
  const period = periodFromParams(await searchParams);
  const scoped: LeadFilter = {
    ...scope,
    ...(period.from ? { createdFrom: period.from } : {}),
    ...(period.to ? { createdTo: period.to } : {}),
  };

  const [
    { rows: leads },
    allUsers,
    counts,
    openInRange,
    openAllTime,
    leadCosts,
    allDeals,
    packages,
  ] = await Promise.all([
    db.leads.list(scoped),
    db.users.listActive(),
    db.leads.countByStatus(scoped),

    /*
     * ⚠️⚠️ שתי ספירות של לידים **פתוחים** — בתוך הטווח ומחוץ לזמן.
     * ההפרש ביניהן הוא כמה עבודה פתוחה החתך מסתיר, וזו האזהרה
     * היחידה שמונעת מברירת המחדל החודשית לבלוע לידים ב-1 בחודש.
     * ראה PeriodPicker › openOutsideRange.
     */
    db.leads.countByStatus({ ...scoped, openOnly: true }),
    db.leads.countByStatus({ ...scope, openOnly: true }),

    db.settings.getLeadCosts(),
    db.deals.list(),
    db.packages.list(),
  ]);

  const sum = (c: Record<string, number>) =>
    Object.values(c).reduce((a, b) => a + b, 0);
  const openOutsideRange = Math.max(0, sum(openAllTime) - sum(openInRange));

  /*
   * ⚠️ המסך שולח יותר מהלידים עצמם, וגם הנלווה חייב להיחתך.
   *
   * `users` — הרכיבים למטה קוראים מהמשתמש רק `id`, `name` ו-`role`
   * (מפת המשויכים, בורר השיוך, תווית התפקיד בפאנל הביצועים). המייל,
   * הטלפון והחנות של כל עובד בארגון נסעו לדפדפן בלי שאיש יקרא אותם.
   */
  /*
   * ⚠️ מי שאינו נכנס ל-CRM לא מוצע כמטפל. `siteManager` הוא אחראי תוכן
   * האתר — הוא יושב באותה טבלת משתמשים ולכן חוזר מ-`listActive`, אבל
   * ליד שישויך אליו נופל לתיבה שאיש לא פותח: הוא לא יכול להתחבר לכאן
   * בכלל.
   */
  const users = allUsers
    .filter((u) => canUseCrm(u.role))
    .map(({ id, name, role }): UserRef => ({
      id,
      name,
      role,
    }));

  /*
   * `deals` — רק עסקאות של הלידים שנשלחים למסך.
   *
   * ⚠️ הלקוח כבר מצמצם לזה בעצמו (`dealsForLeads` ב-`LeadsClient`),
   * אבל צמצום בלקוח משאיר את **כל** עסקאות הארגון ב-payload — הכנסה,
   * עמלה ומזהה סוכן לכל עסקה — אצל כל עובד שפותח את מסך הלידים.
   * `canSeeAll` הסתיר את פאנל הפיננסים, לא את הנתונים שמאחוריו. זו
   * בדיוק הטעות שההערה בראש הקובץ מזהירה ממנה לגבי הלידים עצמם.
   *
   * מוחל תמיד ולא רק כשאין הרשאה: למנהל `leads` הוא ממילא כל הטבלה,
   * כך שזה כמעט no-op, ומסלול קוד אחד שווה יותר משניים.
   */
  const leadIds = new Set(leads.map((l) => l.id));
  const deals = allDeals.filter((d) => leadIds.has(d.leadId));

  /*
   * `leadCosts` נשאר במלואו, וזו החלטה ולא השמטה: אלה שישה מספרי
   * תצורה ברמת קטגוריה, לא נתונים של אף אדם, והתצוגה שלהם ממילא
   * מגודרת ב-`canSeeAll`. הסרתם הייתה שאלה של מוצר — מה מסך הלידים
   * מציג לעובד — ולא של אבטחה.
   */

  return (
    <LeadsClient
      leads={leads}
      users={users}
      counts={counts}
      leadCosts={leadCosts}
      deals={deals}
      packages={packages}
      currentUserId={currentUser.id}
      canSeeAll={canSeeAllLeads(currentUser.role)}
      canEditCosts={canManageSettings(currentUser.role)}
      periodPicker={
        <PeriodPicker period={period} openOutsideRange={openOutsideRange} />
      }
    />
  );
}
