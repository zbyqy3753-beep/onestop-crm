/**
 * שלד טעינה ל"לידים שפוספסו".
 *
 * ⚠️ בלעדיו Next היה מציג כאן את `leads/loading.tsx` — שלד של שורת
 * מסננים ושישה כרטיסי ליד ברוחב מלא — כי `loading` של מקטע עוטף גם את
 * המקטעים שמתחתיו. כאן השלד מחקה את המסך האמיתי: אותו מכל כמו
 * `MissedLeadsClient`, משפט הסיכום, שלושת צ'יפי הקבוצות, שורת החיפוש
 * ורשת הכרטיסים — כדי שהתוכן לא יקפוץ כשהדף מחליף את השלד.
 *
 * רכיב שרת סטטי, בלי קוד לקוח.
 */
export default function MissedLeadsLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="טוען לידים שפוספסו…"
      className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6"
    >
      <div className="mb-4">
        {/* הכותרת — בטלפון היא בסרגל העליון, ולכן גם השלד שלה רק בשולחן */}
        <div className="mb-1.5 hidden h-7 w-44 animate-pulse rounded-md bg-surface-3 lg:block" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded bg-surface-3" />
      </div>

      <div className="flex flex-wrap gap-2">
        {["w-32", "w-36", "w-32"].map((w, i) => (
          <div
            key={i}
            className={`h-11 ${w} animate-pulse rounded-full border border-line bg-surface lg:h-8`}
          />
        ))}
      </div>
      <div className="mb-4 mt-2 h-3 w-56 animate-pulse rounded bg-surface-3" />

      <div className="mb-3 flex lg:justify-end">
        <div className="h-11 w-full animate-pulse rounded-md border border-line bg-surface lg:h-8 lg:w-72" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-44 animate-pulse rounded-card border border-line bg-surface"
          />
        ))}
      </div>
    </div>
  );
}
