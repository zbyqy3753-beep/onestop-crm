/**
 * שלד טעינה למסך הלידים — מוצג בזמן שרכיב השרת של `/leads` שולף מה-repository.
 *
 * בלי הקובץ הזה לחיצה על טאב "לידים" מרגישה מתה: הניווט מחכה לשליפה
 * ורק אז מצייר משהו. Next מציג את הקובץ הזה מיידית דרך Suspense.
 *
 * חשוב: המכל כאן זהה למכל האמיתי ב-`LeadsClient`
 * (`mx-auto max-w-[1600px] px-4 py-3 sm:px-6`) כדי שהתוכן לא "יקפוץ"
 * כשהדף האמיתי מחליף את השלד. רכיב שרת סטטי בכוונה — בלי קוד לקוח.
 */
export default function LeadsLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="טוען לידים…"
      className="mx-auto max-w-[1600px] px-4 py-3 sm:px-6"
    >
      {/* מציין מקום לכותרת המסך */}
      <div className="mb-4 h-8 w-40 animate-pulse rounded-card bg-surface-2" />

      {/* מציין מקום לשורת החיפוש והמסננים */}
      <div className="mb-4 h-11 w-full animate-pulse rounded-card border border-line bg-surface-2" />

      {/* שישה מצייני מקום לכרטיסי לידים */}
      <div className="flex flex-col gap-2">
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
