"use client";

import type { Lead, LeadStatus, Priority } from "@/lib/domain/types";
import {
  LEAD_CATEGORY_CONFIG,
  PRIORITY_CONFIG,
  PRIORITY_ORDER,
  PROVIDER_CONFIG,
  SOURCE_CONFIG,
  STATUS_CONFIG,
} from "@/lib/domain/types";
import { TONE_VAR, phone, relative, until, waLink } from "@/lib/format";
import { whatsappGreeting } from "@/lib/domain/types";
import { dateTimeInputValue } from "@/lib/tz";
import type { LeadPatch } from "@/app/(app)/leads/actions";
import { Badge } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import {
  FollowUpCell,
  InlinePicker,
  StarToggle,
  StatusPicker,
} from "./cells";

/** סולם ניסיונות "אין מענה" — הצ׳יפ המהיר מתקדם בו שלב בכל נגיעה. */
const NO_ANSWER_SEQUENCE: LeadStatus[] = ["noAnswer", "noAnswer1", "noAnswer2"];

/**
 * ליד אחד ככרטיס — תצוגת הטלפון.
 *
 * הכרטיס **אינו** נגזר מ-`columns.ts`. `COLUMNS` הוא מודל צפיפות של
 * טבלה רחבה, ובורר העמודות הוא כלי של שולחן; כרטיס הוא פריסה מעוצבת
 * ביד. מה שכן משותף הוא הפקדים עצמם (`StatusPicker`, `InlinePicker`,
 * `RowActions`…) — אותם רכיבים בדיוק שהשורה משתמשת בהם, כך שהתנהגות
 * העריכה זהה בשתי התצוגות ואין שני מימושים שיכולים להיפרד.
 *
 * מה שעל הכרטיס עונה על שאלה אחת: **למי אני מתקשר עכשיו, ובשביל מה.**
 * שם, טלפון, קטגוריה וחבילה, סטטוס, עדיפות, מתי לחזור, המקור, ודרכי
 * הקשר.
 *
 * מה שלא עליו — עלות, פעילות, ספק, עיר, אימייל — נמצא במגירה, שכבר
 * היום נפתחת כגיליון מסך-מלא ב-390px. זו לא פשרה: שתי רמות מידע, לא
 * אחת מקוצצת.
 */
export function LeadCard({
  lead,
  now,
  checked,
  selecting,
  busy,
  onToggle,
  onOpen,
  onStatus,
  onQuickStatus,
  onStar,
  onPatch,
  showAssignee = false,
  assigneeName,
}: {
  lead: Lead;
  now: number | null;
  checked: boolean;
  /** מצב בחירה מרובה — לחיצה על הכרטיס מסמנת במקום לפתוח */
  selecting: boolean;
  busy: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onStatus: (to: LeadStatus) => void;
  /**
   * שינוי סטטוס **בלי דיאלוג** — לצ׳יפ "אין מענה". אופציונלי:
   * כשלא סופק, הצ׳יפ נופל ל-`onStatus` הרגיל (עם דיאלוג).
   */
  onQuickStatus?: (to: LeadStatus) => void;
  onStar: (next: boolean) => void;
  onPatch: (patch: LeadPatch) => void;
  /**
   * האם להציג בכלל את השיוך — נכון רק למי שרואה את כל הלידים.
   *
   * ⚠️ נפרד מ-`assigneeName` בכוונה. קודם השניים היו אותו שדה, ולכן
   * ליד **ללא שיוך** נראה בדיוק כמו ליד של עובד אחר: שניהם `undefined`.
   * זה בדיוק המצב שמנהל הכי צריך לראות — ליד שאיש לא מטפל בו.
   */
  showAssignee?: boolean;
  /** שם העובד המשויך, אם יש. */
  assigneeName?: string;
}) {
  const priority = PRIORITY_CONFIG[lead.priority];
  const status = STATUS_CONFIG[lead.status];
  const source = SOURCE_CONFIG[lead.source];

  /** הפירוט האחרון שהסוכן הזין — אותה נגזרת כמו ב-`LeadRow`. */
  const lastDetail = [...lead.history].reverse().find((h) => h.detail)?.detail;

  /**
   * שעת החזרה כבר עברה — הליד זועק, לא ממתין.
   *
   * ⚠️ השוואת רגעים ולא ימי לוח: מרגע שיש שעה, חזרה שנקבעה להיום
   * 09:00 היא באיחור כבר ב-11:00, ולא רק למחרת בחצות.
   */
  const overdue =
    now !== null &&
    lead.followUpAt !== undefined &&
    Date.parse(lead.followUpAt) < now;

  // ⚠️ הספק והחבילה מוצגים **ביחד**. הם מגיעים מהשותף כמחרוזת אחת
  // ("ULTIMATE – YES") ונשמרים בשתי עמודות, ולכן החבילה לבדה נראית
  // חתוכה: "ULTIMATE" בלי "YES" הוא לא שם חבילה שאפשר לעבוד איתו.
  // הפיצול נכון לנתונים (אפשר לסנן לפי ספק), ההצגה חייבת לאחד בחזרה.
  const packageLabel = [
    lead.currentProvider ? PROVIDER_CONFIG[lead.currentProvider].label : "",
    lead.packageName?.trim() ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const interest = [
    lead.category ? LEAD_CATEGORY_CONFIG[lead.category].label : "",
    packageLabel,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li
      // `.spine` ולא `.spine-cell` — כאן זה `<li>` ולא תא טבלה, ולכן
      // אין את בעיית התא האנונימי שמתוארת ב-globals.css
      className={`spine group relative rounded-card border bg-surface py-2.5 pe-2 ps-3.5 transition-colors ${
        checked ? "border-brand bg-brand-soft" : "border-line"
      }`}
      style={
        {
          "--spine-c": TONE_VAR[status.tone],
          "--spine-w": lead.priority === "urgent" ? "5px" : "3px",
        } as React.CSSProperties
      }
    >
      <div className="flex items-start gap-2">
        {selecting ? (
          // `-m-3.5 p-3.5` מרחיב את אזור הלחיצה סביב צ׳קבוקס של ~16px
          // ל-44px בלי לשנות את הפריסה — המרווח השלילי מבטל את מה
          // שהריפוד מוסיף לתפוסת המקום.
          <label className="-m-3.5 shrink-0 cursor-pointer p-3.5">
            <input
              type="checkbox"
              checked={checked}
              onChange={onToggle}
              aria-label={`בחירת ${lead.name}`}
              className="accent-[var(--c-brand)]"
            />
          </label>
        ) : (
          <StarToggle lead={lead} onToggle={onStar} busy={busy} />
        )}

        <button
          onClick={selecting ? onToggle : onOpen}
          className="min-w-0 flex-1 text-start"
        >
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold text-ink-1">
              {lead.name}
            </span>
            {lead.kind === "hot" && (
              <span
                className="size-1.5 shrink-0 rounded-full bg-bad"
                aria-label="ליד חם"
              />
            )}
          </span>
          {/* הטלפון ובמה הוא מתעניין — שורה אחת, לא שתיים */}
          <span className="mt-0.5 flex items-baseline gap-1.5 text-[12px]">
            <span className="ltr-num shrink-0 text-ink-3">
              {phone(lead.phone)}
            </span>
            {interest && (
              <span className="truncate text-ink-4">· {interest}</span>
            )}
          </span>

          {/*
            הפירוט האחרון מההיסטוריה — מה שהסוכן קורא לפני שהוא מחייג.
            הוא קיים בטבלה בשולחן (`LeadRow`), ודווקא בטלפון — המכשיר
            שממנו מחייגים — הוא חסר, מה שאילץ פתיחת מגירה לכל ליד.
            שורה אחת מקוצצת, רק כשיש מה להראות.
          */}
          {lastDetail && (
            <span className="mt-0.5 block truncate text-[12px] text-ink-3">
              {lastDetail}
            </span>
          )}
        </button>

        {/*
          כפתור החיוג — הפעולה שבשבילה המסך הזה נפתח בטלפון מלכתחילה.

          ⚠️ הוא ישב קודם בתחתית הכרטיס, מאחורי קו מפריד, בגודל 32px,
          בשורה משלו שעלתה 45px. עכשיו הוא העוגן החזותי של הכרטיס:
          44px, צבע מותג, בקצה העוקב של השורה הראשונה.
        */}
        {!selecting && (
          <a
            href={`tel:${lead.phone}`}
            onClick={(e) => e.stopPropagation()}
            aria-label={`חיוג ל${lead.name}`}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand transition-transform active:scale-90"
          >
            <Icon name="phone" size={18} />
          </a>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <StatusPicker current={lead.status} onPick={onStatus} busy={busy} />

        <InlinePicker
          value={lead.priority}
          label="שינוי עדיפות"
          busy={busy}
          onPick={(v) => onPatch({ priority: v as Priority })}
          options={PRIORITY_ORDER.map((p) => ({
            value: p,
            label: PRIORITY_CONFIG[p].label,
          }))}
        >
          {lead.priority === "normal" ? (
            <span className="text-xs text-ink-4">רגיל</span>
          ) : (
            <Badge tone={priority.tone}>{priority.label}</Badge>
          )}
        </InlinePicker>

        <FollowUpCell
          value={
            lead.followUpAt ? dateTimeInputValue(Date.parse(lead.followUpAt)) : ""
          }
          busy={busy}
          onPick={(v) => onPatch({ followUpDate: v || null })}
        >
          {lead.followUpAt && now !== null ? (
            // באיחור — אדום ומודגש; `until()` כבר אומר "באיחור X ימים",
            // כך שהצבע רק מחזק ולא מוסיף מילים. היום/עתיד נשארים בצהוב.
            <span
              className={`flex items-center gap-1 text-xs ${
                overdue ? "font-semibold text-bad" : "text-warn"
              }`}
            >
              <Icon name="clock" size={12} />
              {until(lead.followUpAt, now)}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-ink-4">
              <Icon name="clock" size={12} />
              קבע חזרה
            </span>
          )}
        </FollowUpCell>

        {/*
          מאיפה הליד הגיע.

          היה זמין רק במגירה, ודווקא בטלפון — המכשיר שממנו מחייגים —
          זו פיסת המידע שקובעת איך פותחים: הפניה מלקוח מרוצה, פנייה
          מטופס וקמפיין חידושים הן שלוש שיחות שונות לגמרי.

          התגית נושאת את הערוץ; הפירוט החופשי (`sourceDetail`) נשאר
          במגירה, כי הוא משפט שלם ולא צ׳יפ.
        */}
        <Badge tone={source.tone}>{source.label}</Badge>

        {/*
          התוצאה הנפוצה ביותר של חיוג — "אין מענה" — בלחיצה אחת,
          בלי לפתוח את בורר הסטטוסים. דרך `onQuickStatus` היא גם
          מדלגת על הדיאלוג; בלעדיו נופלים ל-`onStatus` הרגיל.

          שלושה סטטוסים מפורשים ולא מונה: "אין מענה" → "אין מענה 1" →
          "אין מענה 2". הצ׳יפ תמיד מציג את השלב **הבא** בסולם, כך
          שלחיצה חוזרת מתקדמת בו; מכל סטטוס אחר הלחיצה מתחילה מהתחלה.
          נעלם כשמגיעים לסוף הסולם או שהליד נסגר.
        */}
        {!status.terminal &&
          (() => {
            const idx = NO_ANSWER_SEQUENCE.indexOf(lead.status);
            const next =
              idx === -1 ? NO_ANSWER_SEQUENCE[0] : NO_ANSWER_SEQUENCE[idx + 1];
            if (!next) return null;
            return (
              <button
                onClick={() => (onQuickStatus ?? onStatus)(next)}
                disabled={busy}
                // 36px גובה ויזואלי, 44px אזור לחיצה: הפסאודו-אלמנט מרחיב
                // בלי להוסיף גובה לשורה — אותו דפוס כמו הכוכב והוואטסאפ
                className="relative min-h-9 rounded-full border border-line px-2.5 text-xs text-ink-2 transition-transform after:absolute after:-inset-1 after:content-[''] active:scale-95 disabled:opacity-50"
              >
                {STATUS_CONFIG[next].label}
              </button>
            );
          })()}

        {/*
          וואטסאפ והזמן היחסי בקצה אותה שורה.

          ⚠️ כאן ישבה שורת `RowActions` שלמה מאחורי קו מפריד — 45px
          בכל כרטיס. מה שירד ממנה: החיוג עלה לשורה הראשונה, המייל ירד
          למגירה (הוא לא פעולה של תור חיוג), והצ׳ברון "פתיחת הליד"
          נמחק כי גוף הכרטיס כולו כבר כפתור שפותח אותו.
        */}
        <a
          href={waLink(lead.phone, whatsappGreeting(lead.name))}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          aria-label={`וואטסאפ ל${lead.name}`}
          // `-inset-2.5` ולא `-inset-2`: 24px + 10 מכל צד = 44 בדיוק
          className="relative ms-auto rounded-lg p-1 text-ink-3 after:absolute after:-inset-2.5 after:content-[''] active:scale-90"
        >
          <Icon name="whatsapp" size={16} />
        </a>

        {/*
          מי מחזיק את הליד גובר על "עודכן לפני X".

          למנהל שרואה את כל הארגון, כרטיס בלי שם עובד לא אומר אם הליד
          מטופל בכלל — וזו השאלה שבגללה הוא פתח את המסך. הזמן היחסי
          לעומת זאת אינו פעולתי, ושתי הפיסות לא נכנסות באותו קצה
          במסך של 375px. לעובד (שרואה רק את שלו) אין שם מה להציג,
          ולכן הוא ממשיך לראות את הזמן.
        */}
        {showAssignee ? (
          // ⚠️ עיגול ראשי-תיבות ולא עוד טקסט אפור. קודם שם העובד נכתב
          // באותו גודל וצבע של "לפני 3 שע׳" באותו מקום בדיוק, ולכן
          // נקרא כחותמת זמן. ליד ללא שיוך מקבל טון אזהרה — הוא לא
          // "מידע חסר" אלא ליד שאיש לא מטפל בו.
          <span
            className={`flex min-w-0 shrink-0 items-center gap-1 text-[11px] ${
              assigneeName ? "text-ink-3" : "text-warn"
            }`}
            title={assigneeName ? `משויך ל${assigneeName}` : "ללא שיוך"}
          >
            <span
              className={`grid size-5 shrink-0 place-items-center rounded-full text-[9px] font-bold ${
                assigneeName
                  ? "bg-surface-3 text-ink-2"
                  : "bg-warn-soft text-warn"
              }`}
              aria-hidden
            >
              {assigneeName ? assigneeName.slice(0, 2) : "?"}
            </span>
            <span className="max-w-[72px] truncate">
              {assigneeName ?? "ללא שיוך"}
            </span>
          </span>
        ) : (
          <span className="shrink-0 truncate whitespace-nowrap text-[11px] text-ink-4">
            {now === null ? "" : relative(lead.updatedAt, now)}
          </span>
        )}
      </div>
    </li>
  );
}
