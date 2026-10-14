/**
 * שלד טעינה למסך הלידים — מוצג בזמן שרכיב השרת של `/leads` שולף מה-repository.
 *
 * בלי הקובץ הזה לחיצה על טאב "לידים" מרגישה מתה: הניווט מחכה לשליפה
 * ורק אז מצייר משהו. Next מציג את הקובץ הזה מיידית דרך Suspense.
 *
 * חשוב: המכל כאן זהה למכל האמיתי ב-`LeadsClient`
 * (`mx-auto max-w-[1600px] px-4 py-3 sm:px-6`) כדי שהתוכן לא "יקפוץ"
 * כשהדף האמיתי מחליף את השלד. רכיב שרת סטטי בכוונה — בלי קוד לקוח.
 *
 * ⚠️ הסדר כאן הוא הסדר של המסך (`QueueHeader` ← `FilterBar` ← רשימה):
 * כותרת, חודשים, סיכום, קוביות סטטוס, חיפוש, תצוגות מהירות, כרטיסים.
 * שלד בסדר אחר מקפיץ כל בלוק למקום אחר ברגע שהנתונים מגיעים.
 * רצועת "להתקשר היום" לא מצוירת — היא נגזרת רק אחרי ההרכבה, ובלי
 * תזכורות היא לא קיימת בכלל; מציין מקום בשבילה היה מבטיח שורה שנעלמת.
 */
export default function LeadsLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="טוען לידים…"
      className="mx-auto max-w-[1600px] px-4 py-3 sm:px-6"
    >
      {/* כותרת ופעולות — בשולחן בלבד, כמו ב-`QueueHeader` */}
      <div className="mb-3 hidden items-center justify-between gap-4 lg:flex">
        <div className="h-6 w-36 animate-pulse rounded-card bg-surface-2" />
        <div className="h-9 w-80 animate-pulse rounded-card bg-surface-2" />
      </div>

      {/* תיקיית החודשים */}
      <div className="mb-3 flex gap-1.5 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-11 w-24 shrink-0 animate-pulse rounded-full border border-line bg-surface-2 lg:h-8"
          />
        ))}
      </div>

      {/* משפט הסיכום */}
      <div className="mb-3 h-5 w-72 max-w-full animate-pulse rounded-card bg-surface-2" />

      {/* קוביות הסטטוס */}
      <div className="mb-3 flex gap-1.5 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-12 min-w-[92px] flex-1 shrink-0 animate-pulse rounded-card bg-surface-2"
          />
        ))}
      </div>

      {/* חיפוש ומיון */}
      <div className="mb-3 h-11 w-full animate-pulse rounded-card border border-line bg-surface-2 lg:h-9" />

      {/* תצוגות מהירות */}
      <div className="mb-3 flex gap-1.5 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="h-11 w-20 shrink-0 animate-pulse rounded-full border border-line bg-surface-2 lg:h-8"
          />
        ))}
      </div>

      {/* כרטיסי לידים — ברירת המחדל גם בשולחן */}
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-[8.5rem] animate-pulse rounded-card border border-line bg-surface-2"
          />
        ))}
      </div>
    </div>
  );
}
