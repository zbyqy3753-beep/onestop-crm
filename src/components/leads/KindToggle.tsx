"use client";

import type { LeadKind } from "@/lib/domain/types";
import { KIND_CONFIG, KIND_ORDER } from "@/lib/domain/types";

/**
 * שני מתגים לסוג הליד: חם ודאטה קרה.
 *
 * ⚠️ **ממד, לא תצוגה** — וזו כל הסיבה שהוא רכיב נפרד ולא עוד שני
 * צ׳יפים ב-`QUICK_VIEWS`. כצ׳יפים הם היו `patch: () => ({...EMPTY_FILTERS,
 * kind})`, כלומר הדרך היחידה לראות דאטה קרה מחקה בדרך כל סטטוס, שיוך
 * או עדיפות שהיו פעילים. "הדאטה הקרה שבאין מענה" לא היה ניתן לביטוי.
 *
 * ⚠️ **שניהם כבויים = חם בלבד**, ולא "הכל". זו לא שרירות אלא הכלל
 * שכבר קיים ב-`LeadsClient` › `preStatus`: דאטה קרה מוסתרת עד שמבקשים
 * אותה במפורש, כי ייבוא אחד הכניס 358 שורות קרות שקוברות את תור
 * העבודה של היום. מה שהמתגים משנים זה שלכלל הזה יש סוף-סוף פקד גלוי
 * במקום להיות התנהגות סמויה שמסבירים אותה בהערה.
 *
 * המיפוי היחיד שאינו טריוויאלי: "רק דאטה" הוא `["data"]`, ושניהם
 * דלוקים הוא `["hot","data"]` — כלומר באמת הכל.
 */
export function KindToggle({
  value,
  onChange,
}: {
  value: LeadKind[];
  onChange: (kind: LeadKind[]) => void;
}) {
  /*
    מערך ריק פירושו "חם בלבד", ולכן המתג "חם" נראה דלוק גם כשהמערך
    ריק. בלי זה המשתמש רואה שני מתגים כבויים מעל טבלה שמציגה רק לידים
    חמים — מסך שסותר את עצמו.
  */
  const on = (kind: LeadKind) =>
    value.length === 0 ? kind === "hot" : value.includes(kind);

  const toggle = (kind: LeadKind) => {
    const current: LeadKind[] = value.length === 0 ? ["hot"] : value;
    const next = current.includes(kind)
      ? current.filter((k) => k !== kind)
      : [...current, kind];

    /*
      ⚠️ נרמול: גם "כלום" וגם "חם בלבד" נשלחים כ-`[]`.

      השניים זהים לחלוטין בהתנהגות (`preStatus` מסתיר דאטה קרה כשהמערך
      ריק), ובלי הנרמול `["hot"]` היה נספר כמסנן פעיל — "ניקוי (1)" על
      מסך שלא סוננ, ומצב ריק שמכריז "אין לידים שתואמים לסינון" במקום
      "אין לידים עדיין". מסנן שנחשב פעיל ולא משנה שום שורה הוא שקר קטן
      שמתגלגל לשלושה מקומות.

      כיבוי שני המתגים מחזיר לברירת המחדל ולא לטבלה ריקה — אין כאן מצב
      שאי אפשר לצאת ממנו.
    */
    const onlyHot = next.length === 1 && next[0] === "hot";
    onChange(next.length === 0 || onlyHot ? [] : next);
  };

  return (
    <div
      className="flex shrink-0 items-center gap-1.5"
      role="group"
      aria-label="סוג ליד"
    >
      {KIND_ORDER.map((kind) => {
        const active = on(kind);
        return (
          <button
            key={kind}
            onClick={() => toggle(kind)}
            aria-pressed={active}
            title={KIND_CONFIG[kind].plural}
            // אותם גדלים בדיוק כמו צ׳יפי התצוגות המהירות שלצידם —
            // שני פקדים באותה שורה שנבדלים ב-4px גובה נראים כמו תקלה
            className={`min-h-11 shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors active:scale-95 lg:min-h-0 lg:active:scale-100 ${
              active
                ? "border-brand bg-brand-soft text-brand"
                : "border-line bg-surface text-ink-3 hover:border-line-strong hover:text-ink-1"
            }`}
          >
            {KIND_CONFIG[kind].short}
          </button>
        );
      })}
    </div>
  );
}
