"use client";

import { useRef } from "react";
import type { Lead, LeadStatus, Priority, UserRef } from "@/lib/domain/types";
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
import { useDetailsAutoClose } from "@/lib/overlay";
import type { LeadPatch } from "@/app/(app)/leads/actions";
import { Badge, TeamBadge } from "@/components/ui/primitives";
import { Icon, type IconKey } from "@/components/ui/Icon";
import {
  AgeBadge,
  AssigneeAvatar,
  CarriedBadge,
  FollowUpCell,
  HotBadge,
  InlinePicker,
  StarToggle,
  StatusPicker,
  dialAttempts,
  safeTime,
} from "./cells";

/** סולם ניסיונות "אין מענה" — הצ׳יפ המהיר מתקדם בו שלב בכל נגיעה. */
const NO_ANSWER_SEQUENCE: LeadStatus[] = ["noAnswer", "noAnswer1", "noAnswer2"];

/**
 * ליד אחד ככרטיס — בטלפון, ומאוקטובר 2026 גם בשולחן.
 *
 * הכרטיס **אינו** נגזר מ-`columns.ts`. `COLUMNS` הוא מודל צפיפות של
 * טבלה רחבה, ובורר העמודות הוא כלי של שולחן; כרטיס הוא פריסה מעוצבת
 * ביד. מה שכן משותף הוא הפקדים עצמם (`StatusPicker`, `InlinePicker`,
 * `FollowUpCell`…) — אותם רכיבים בדיוק שהשורה משתמשת בהם, כך שהתנהגות
 * העריכה זהה בשתי התצוגות ואין שני מימושים שיכולים להיפרד.
 *
 * המבנה הוא של מערכת הלידים שהמשתמש הצביע עליה (DC), בצבעים ובפרימיטיבים
 * של המקור — ראה `docs/superpowers/specs/2026-10-14-dc-order-on-original.md`:
 *
 *   1. השם, וליד-ו: כמה זמן הוא במערכת (אפור), "חם", "נגרר מ…".
 *   2. הטלפון כקישור כחול, וואטסאפ ירוק, ובאפור במה הוא מתעניין.
 *   3. ההערה האחרונה (כשיש).
 *   4. תגיות רכות: סטטוס (שהוא גם הבורר), עדיפות, מקור, חזרה, "אין מענה".
 *   5. מטא אפור: ניסיונות חיוג · עודכן · מטפל.
 *   + כוכב ו-"⋯" בצד הסוף.
 *
 * ⚠️ **אותו DOM בטלפון ובשולחן — הפריסה נקבעת ברוחב הכרטיס עצמו**
 * (`@container`), לא ברוחב המסך. בכרטיס צר המידע נערם והפעולות יורדות
 * לשורת המטא, ליד האגודל; מ-42rem הכרטיס נפתח לשלושה אזורים — זהות |
 * מצב+מטא | פעולות — וגבולות האזורים מיושרים בין כל הכרטיסים ברשימה,
 * כך שאפשר לסרוק עמודה. כרטיס טלפון שנמתח ל-1100px היה רצועה של טקסט
 * בצד אחד ושטח ריק בשני.
 *
 * מה שלא על הכרטיס — עלות, עיר, פעילות מלאה — נמצא במגירה. שתי רמות
 * מידע, לא אחת מקוצצת.
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
  canSeeAll = false,
  showAssignee = canSeeAll,
  assigneeName,
  assigneeTeamOwner,
  users,
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
   * תצוגה ניהולית — השיוך והמקור.
   *
   * שניהם עונים על שאלות של מי שמנהל את מאגר הלידים ולא של מי שמחייג:
   * מי מחזיק מה, ומאיפה הלידים מגיעים. לעובד כל הלידים שהוא רואה הם
   * ממילא שלו.
   *
   * ⚠️ נפרד מ-`assigneeName` בכוונה. קודם השניים היו אותו שדה, ולכן
   * ליד **ללא שיוך** נראה בדיוק כמו ליד של עובד אחר: שניהם `undefined`.
   * זה בדיוק המצב שמנהל הכי צריך לראות — ליד שאיש לא מטפל בו.
   */
  canSeeAll?: boolean;
  /**
   * הצגת המטפל בשורת המטא. ברירת המחדל היא `canSeeAll`; בעל עסק מקבל
   * אותה בלי שאר התצוגה הניהולית (המקור).
   */
  showAssignee?: boolean;
  /** שם העובד המשויך, אם יש. */
  assigneeName?: string;
  /**
   * כשהמטפל משויך לבעל עסק — שם בעל העסק (או `""` כשאינו ידוע).
   * `undefined` = לא משויך, ואז אין תגית.
   */
  assigneeTeamOwner?: string;
  /**
   * העובדים שאפשר לשייך אליהם. כשיש (ו-`showAssignee`), המטפל בשורת
   * המטא הוא גם בורר השיוך — כמו עמודת השיוך בטבלה. בלעדיהם הוא תצוגה
   * בלבד.
   */
  users?: UserRef[];
}) {
  const priority = PRIORITY_CONFIG[lead.priority];
  const status = STATUS_CONFIG[lead.status];
  const source = SOURCE_CONFIG[lead.source];

  /** הפירוט האחרון שהסוכן הזין — אותה נגזרת כמו ב-`LeadRow`. */
  const lastDetail = [...lead.history].reverse().find((h) => h.detail)?.detail;

  const attempts = dialAttempts(lead);
  // ⚠️ `safeTime` לפני כל פורמט תאריך — ראה `cells.tsx`. ליד אחד עם
  // תאריך פגום הפיל קודם את כל הרשימה.
  const updatedAt = safeTime(lead.updatedAt);
  const followUpAt = safeTime(lead.followUpAt);

  /**
   * שעת החזרה כבר עברה — הליד זועק, לא ממתין.
   *
   * ⚠️ השוואת רגעים ולא ימי לוח: מרגע שיש שעה, חזרה שנקבעה להיום
   * 09:00 היא באיחור כבר ב-11:00, ולא רק למחרת בחצות.
   */
  const overdue = now !== null && followUpAt !== null && followUpAt < now;

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

  /*
    התוצאה הנפוצה ביותר של חיוג — "אין מענה" — בלחיצה אחת, בלי לפתוח את
    בורר הסטטוסים. דרך `onQuickStatus` היא גם מדלגת על הדיאלוג; בלעדיו
    נופלים ל-`onStatus` הרגיל.

    שלושה סטטוסים מפורשים ולא מונה: "אין מענה" → "אין מענה 1" →
    "אין מענה 2". הצ׳יפ תמיד מציג את השלב **הבא** בסולם, כך שלחיצה
    חוזרת מתקדמת בו; מכל סטטוס אחר הלחיצה מתחילה מהתחלה. נעלם כשמגיעים
    לסוף הסולם או שהליד נסגר.
  */
  const quickNext: LeadStatus | null = status.terminal
    ? null
    : (() => {
        const idx = NO_ANSWER_SEQUENCE.indexOf(lead.status);
        return (idx === -1 ? NO_ANSWER_SEQUENCE[0] : NO_ANSWER_SEQUENCE[idx + 1]) ?? null;
      })();

  /** בורר השיוך — רק למי שרואה מי מטפל, ורק כשיש רשימת עובדים */
  const assignOptions =
    showAssignee && users
      ? [
          { value: "", label: "ללא שיוך" },
          ...users.map((u) => ({ value: u.id, label: u.name })),
        ]
      : null;

  /*
    "⋯" — פעולות משניות. מה שנפוץ (סטטוס, חיוג, וואטסאפ, חזרה, סימון)
    גלוי על הכרטיס עצמו; כאן יושב מה שנעשה מדי פעם.

    ⚠️ העדיפות כאן ולא רק בתגית: עדיפות "רגיל" לא מקבלת תגית (תגית
    "רגיל" על כל כרטיס היא רעש), ולכן בלי התפריט לא הייתה דרך להעלות
    עדיפות מהכרטיס. כשיש תגית — היא עצמה גם הבורר.

    ⚠️ המייל חזר לכרטיס דרך כאן. בגרסה הקודמת הוא ירד למגירה בלבד.
  */
  const menuItems: MenuItem[] = [
    { label: "פתיחת הליד", icon: "chevronLeft", onSelect: onOpen },
    ...(lead.email
      ? [{ label: "שליחת מייל", icon: "mail" as const, href: `mailto:${lead.email}` }]
      : []),
    ...PRIORITY_ORDER.filter((p) => p !== lead.priority).map((p) => ({
      label: `עדיפות: ${PRIORITY_CONFIG[p].label}`,
      icon: (p === "urgent" ? "alert" : p === "high" ? "arrowUp" : undefined) as
        | IconKey
        | undefined,
      disabled: busy,
      onSelect: () => onPatch({ priority: p }),
    })),
    ...(lead.followUpAt
      ? [
          {
            label: "ניקוי מועד החזרה",
            icon: "calendar" as const,
            disabled: busy,
            onSelect: () => onPatch({ followUpDate: null }),
          },
        ]
      : []),
  ];

  return (
    <li
      aria-busy={busy || undefined}
      /*
        `.spine` ולא `.spine-cell` — כאן זה `<li>` ולא תא טבלה, ולכן
        אין את בעיית התא האנונימי שמתוארת ב-globals.css.

        ⚠️ `.spine` נותן גם את `position: relative` — העוגן של שכבת
        הלחיצה של השם, שמכסה את כל הכרטיס (ראה הכפתור למטה).

        ⚠️ `@container` לא הופך את הכרטיס ל-containing block של
        `position: fixed`, ואין עליו `overflow` — עורך מועד החזרה ותפריט
        ה-"⋯" (שניהם במיקום מוחלט) לא נחתכים בקצה הכרטיס.
      */
      className={`@container spine group rounded-card border transition-colors ${
        checked
          ? "border-brand bg-brand-soft"
          : "border-line bg-surface hover:border-line-strong"
      }`}
      style={
        {
          "--spine-c": TONE_VAR[status.tone],
          "--spine-w": lead.priority === "urgent" ? "5px" : "3px",
        } as React.CSSProperties
      }
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 p-4 lg:p-5 @2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_auto] @2xl:gap-x-6 @2xl:gap-y-1.5">
        {/* ── זהות: שם, טלפון, במה הוא מתעניין, ההערה האחרונה ─────────── */}
        <div className="col-span-2 row-start-1 min-w-0 @2xl:col-span-1 @2xl:row-span-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {selecting && (
              // `-m-3.5 p-3.5` מרחיב את אזור הלחיצה סביב צ׳קבוקס של ~16px
              // ל-44px בלי לשנות את הפריסה — המרווח השלילי מבטל את מה
              // שהריפוד מוסיף לתפוסת המקום. `relative z-[1]` — הוא בא
              // **לפני** שכבת הלחיצה של השם ב-DOM, ובלי זה היא נצבעת מעליו.
              <label className="relative z-[1] -m-3.5 shrink-0 cursor-pointer p-3.5">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={onToggle}
                  aria-label={`בחירת ${lead.name}`}
                  className="block size-4 accent-[var(--c-brand)]"
                />
              </label>
            )}

            {/*
              השם הוא הכפתור שפותח את הליד — ו-`after:inset-0` מותח את
              אזור הלחיצה שלו על **כל הכרטיס**. נגיעה בכל מקום שאינו פקד
              פותחת את המגירה (או מסמנת, במצב בחירה).

              ⚠️ זה מחליף את הכפתור הגדול שעטף קודם שם+טלפון+פירוט
              (`min-h-11`, נמדד 43px). הטלפון הוא עכשיו קישור חיוג, ואי
              אפשר לקנן קישור בתוך כפתור — בלי המתיחה אזור הפתיחה היה
              מצטמק לשם בלבד.

              ⚠️ כל פקד בכרטיס הוא `relative` ובא **אחרי** הכפתור הזה
              ב-DOM, ולכן מצויר מעל השכבה ומקבל את הנגיעה שלו. פקד חדש
              שיתווסף בלי `relative` ייבלע בשכבה ויפתח את הליד.
            */}
            <button
              type="button"
              onClick={selecting ? onToggle : onOpen}
              className="min-w-0 max-w-full text-start text-base font-semibold text-ink-1 transition-colors after:absolute after:inset-0 after:content-[''] group-hover:text-brand"
            >
              {/* ה-`title` על הטקסט ולא על הכפתור — על הכפתור הוא היה
                  קופץ בריחוף בכל נקודה בכרטיס, כי השכבה שייכת לכפתור */}
              <span title={lead.name} className="block truncate">
                {lead.name}
              </span>
            </button>

            <AgeBadge createdAt={lead.createdAt} now={now} />
            {lead.kind === "hot" && <HotBadge />}
            <CarriedBadge lead={lead} now={now} />
          </div>

          {/* הטלפון, הוואטסאפ, ובמה הוא מתעניין — שורה אחת */}
          <div className="mt-1 flex min-w-0 items-center gap-x-2 text-sm">
            {/*
              הטלפון הוא פעולת החיוג עצמה: כחול, `tel:`.

              ⚠️ כאן ישב קודם כפתור חיוג עגול של 44px בקצה השורה
              הראשונה. המשתמש בחר את המבנה של DC — מספר כחול שלוחצים
              עליו — ולכן החיוג עבר למספר.

              ⚠️ מטרת המגע: `min-h-6` (24px) + `after:-inset-y-2.5` (10px
              לכל כיוון) = 44px, בלי להגביה את השורה — פסאודו-אלמנט לא
              תופס מקום. בשולחן ההרחבה מצטמצמת, כדי שלא תבלע את תחתית
              השם שמעליה.
            */}
            <a
              href={`tel:${lead.phone}`}
              aria-label={`חיוג ל${lead.name}, ${phone(lead.phone)}`}
              className="relative inline-flex min-h-6 shrink-0 touch-manipulation items-center gap-1.5 rounded font-semibold text-brand after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-[''] hover:underline active:opacity-70 lg:after:-inset-y-1"
            >
              <Icon name="phone" size={14} />
              <span className="ltr-num">{phone(lead.phone)}</span>
            </a>

            {/* `-inset-2.5` ולא `-inset-2`: 24px + 10 מכל צד = 44 בדיוק */}
            <a
              href={waLink(lead.phone, whatsappGreeting(lead.name))}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`וואטסאפ ל${lead.name}`}
              title="וואטסאפ"
              className="relative grid size-6 shrink-0 touch-manipulation place-items-center rounded-lg text-good transition-colors after:absolute after:-inset-2.5 after:content-[''] hover:bg-good-soft active:scale-90 active:bg-good-soft"
            >
              <Icon name="whatsapp" size={18} />
            </a>

            {interest && (
              <span className="min-w-0 truncate text-ink-3" title={interest}>
                <span aria-hidden="true" className="me-2 text-ink-4">
                  ·
                </span>
                {interest}
              </span>
            )}
          </div>

          {/*
            הפירוט האחרון מההיסטוריה — מה שהסוכן קורא לפני שהוא מחייג.
            הוא קיים בטבלה בשולחן (`LeadRow`), ודווקא בטלפון — המכשיר
            שממנו מחייגים — הוא היה חסר, מה שאילץ פתיחת מגירה לכל ליד.
            שורה אחת מקוצצת, רק כשיש מה להראות.
          */}
          {lastDetail && (
            <p className="mt-1 truncate text-sm text-ink-3" title={lastDetail}>
              {lastDetail}
            </p>
          )}
        </div>

        {/* ── מצב: תגיות רכות, שכל אחת מהן היא גם הבורר שלה ─────────── */}
        <div className="col-span-2 row-start-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 @2xl:col-span-1 @2xl:col-start-2 @2xl:row-start-1 @2xl:self-end">
          <StatusPicker current={lead.status} onPick={onStatus} busy={busy} />

          {/*
            עדיפות "רגיל" לא מקבלת תגית — תגית "רגיל" על כל כרטיס היא
            רעש. שינוי ממנה עבר לתפריט ה-"⋯". כשיש תגית, היא גם הבורר.
          */}
          {lead.priority !== "normal" && (
            <InlinePicker
              value={lead.priority}
              label={`שינוי עדיפות (כעת: ${priority.label})`}
              busy={busy}
              onPick={(v) => onPatch({ priority: v as Priority })}
              options={PRIORITY_ORDER.map((p) => ({
                value: p,
                label: PRIORITY_CONFIG[p].label,
              }))}
            >
              <Badge tone={priority.tone}>{priority.label}</Badge>
            </InlinePicker>
          )}

          {/*
            מאיפה הליד הגיע — למי שרואה את כל הארגון.

            ודווקא בטלפון זו פיסת המידע שקובעת איך פותחים: הפניה מלקוח
            מרוצה, פנייה מטופס וקמפיין חידושים הן שלוש שיחות שונות
            לגמרי. התגית נושאת את הערוץ; הפירוט החופשי (`sourceDetail`)
            נשאר במגירה, כי הוא משפט שלם ולא צ׳יפ.
          */}
          {canSeeAll && <Badge tone={source.tone}>{source.label}</Badge>}

          <FollowUpCell
            value={followUpAt === null ? "" : dateTimeInputValue(followUpAt)}
            busy={busy}
            onPick={(v) => onPatch({ followUpDate: v || null })}
          >
            {followUpAt === null ? (
              // מקום ריק שנראה כמו מקום ריק: מסגרת מקווקוות, לא תגית.
              // קביעת חזרה היא חצי מהעבודה, והפקד שלה חייב להיראות כפקד.
              <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-line-strong px-2 py-0.5 text-xs text-ink-3">
                <Icon name="clock" size={12} />
                {lead.followUpAt ? "מועד לא תקין" : "קבע חזרה"}
              </span>
            ) : now === null ? (
              // ⚠️ לפני ההרכבה נשמר מקום ריק ברוחב התגית: הניסוח תלוי
              // ב"עכשיו", וקודם הכרטיס הציג "קבע חזרה" לליד שיש לו חזרה.
              <span aria-hidden="true" className="inline-block h-5 w-20" />
            ) : (
              // באיחור — אדום ומודגש; `until()` כבר אומר "באיחור X ימים",
              // כך שהצבע רק מחזק ולא מוסיף מילים. היום/עתיד בצהוב.
              <Badge tone={overdue ? "bad" : "warn"} className={overdue ? "font-semibold" : ""}>
                <Icon name="clock" size={12} />
                {until(lead.followUpAt!, now)}
              </Badge>
            )}
          </FollowUpCell>

          {quickNext && (
            <button
              type="button"
              onClick={() => (onQuickStatus ?? onStatus)(quickNext)}
              disabled={busy}
              aria-label={`סימון: ${STATUS_CONFIG[quickNext].label}`}
              // 36px גובה ויזואלי, 44px אזור לחיצה: הפסאודו-אלמנט מרחיב
              // בלי להוסיף גובה לשורה — אותו דפוס כמו הכוכב והוואטסאפ.
              // בשולחן הוא בגובה תגית, כדי לא להגביה את שורת התגיות.
              className="relative inline-flex min-h-9 touch-manipulation items-center gap-1 rounded-full border border-line px-2.5 text-xs text-ink-2 transition-transform after:absolute after:-inset-1 after:content-[''] hover:border-line-strong hover:text-ink-1 active:scale-95 disabled:opacity-50 lg:min-h-0 lg:py-0.5"
            >
              <Icon name="plus" size={12} />
              {STATUS_CONFIG[quickNext].label}
            </button>
          )}
        </div>

        {/* ── מטא: ניסיונות, עדכון אחרון, מטפל ────────────────────────── */}
        <div className="col-start-1 row-start-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3 @2xl:col-start-2 @2xl:row-start-2 @2xl:self-start">
          {attempts > 0 && (
            <span className="inline-flex items-center gap-1">
              <Icon name="phone" size={12} className="text-ink-4" />
              <span className="nums">
                {attempts === 1 ? "ניסיון חיוג אחד" : `${attempts} ניסיונות חיוג`}
              </span>
            </span>
          )}

          {/*
            ⚠️ "עודכן", ולא "נכנס": מתי הליד **נכנס** כבר כתוב בגיל שליד
            השם, ושתי אמירות על אותו תאריך הן רעש. ריק עד ההרכבה —
            `relative()` תלוי ב"עכשיו".
          */}
          {now !== null && updatedAt !== null && (
            <span className="whitespace-nowrap">עודכן {relative(lead.updatedAt, now)}</span>
          )}

          {/*
            מי מחזיק את הליד — למנהל ולבעל עסק.

            למנהל שרואה את כל הארגון, כרטיס בלי שם עובד לא אומר אם הליד
            מטופל בכלל — וזו השאלה שבגללה הוא פתח את המסך. ליד ללא שיוך
            מקבל טון אזהרה: הוא לא "מידע חסר" אלא ליד שאיש לא מטפל בו.
            כשיש רשימת עובדים — הוא גם בורר השיוך, כמו עמודת השיוך בטבלה.
          */}
          {showAssignee &&
            (() => {
              const who = (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <AssigneeAvatar name={assigneeName} />
                  <span
                    className={`min-w-0 max-w-[10rem] truncate ${
                      assigneeName ? "text-ink-2" : "font-medium text-warn"
                    }`}
                    title={assigneeName ? `משויך ל${assigneeName}` : "ללא שיוך"}
                  >
                    {assigneeName ?? "ללא שיוך"}
                  </span>
                  {assigneeTeamOwner !== undefined && (
                    <TeamBadge ownerName={assigneeTeamOwner || undefined} />
                  )}
                </span>
              );
              return assignOptions && !selecting ? (
                <InlinePicker
                  value={lead.assigneeId ?? ""}
                  label={assigneeName ? `שיוך לעובד (כעת: ${assigneeName})` : "שיוך לעובד"}
                  busy={busy}
                  onPick={(v) => onPatch({ assigneeId: v || null })}
                  options={assignOptions}
                >
                  {who}
                </InlinePicker>
              ) : (
                who
              );
            })()}
        </div>

        {/* ── פעולות: בצד הסוף, ליד האגודל בטלפון ──────────────────────── */}
        {!selecting && (
          <div className="col-start-2 row-start-3 flex items-center gap-0.5 justify-self-end @2xl:col-start-3 @2xl:row-span-2 @2xl:row-start-1">
            <StarToggle lead={lead} onToggle={onStar} busy={busy} variant="button" />
            <CardMenu label={`פעולות נוספות ל${lead.name}`} items={menuItems} />
          </div>
        )}
      </div>
    </li>
  );
}

type MenuItem = {
  label: string;
  icon?: IconKey;
  disabled?: boolean;
} & ({ onSelect: () => void; href?: never } | { href: string; onSelect?: never });

/**
 * תפריט ה-"⋯" של הכרטיס — `<details>` מקומי, בלי פרימיטיב חדש.
 *
 * ⚠️ `<details>` לא נסגר לבד ב-Escape או בלחיצה בחוץ — `useDetailsAutoClose`
 * מוסיף את שניהם. בחירת פריט סוגרת אותו מפורשות, אחרת הוא נשאר פתוח מעל
 * הכרטיס הבא אחרי שהפעולה כבר רצה.
 *
 * ⚠️ `relative` על ה-`<details>` — גם עוגן לפאנל וגם מה שמעמיד אותו מעל
 * שכבת הלחיצה של השם. `z-30` על הפאנל כדי שייצבע מעל הכרטיסים שאחריו,
 * שגם בהם כל פקד `relative`.
 */
function CardMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useDetailsAutoClose(ref);

  function close() {
    if (ref.current) ref.current.open = false;
  }

  const itemClass =
    "flex min-h-11 w-full touch-manipulation items-center gap-2 rounded px-2 text-start text-sm text-ink-2 hover:bg-surface-2 hover:text-ink-1 active:bg-surface-3 disabled:opacity-50 lg:min-h-0 lg:py-1.5";

  return (
    <details ref={ref} className="relative">
      <summary
        aria-label={label}
        title="פעולות נוספות"
        // 36px בטלפון + `after:-inset-1` = 44px; 32px בשולחן, כמו הכוכב
        className="relative grid size-9 shrink-0 cursor-pointer touch-manipulation list-none place-items-center rounded-lg text-ink-3 transition-colors after:absolute after:-inset-1 after:content-[''] hover:bg-surface-3 hover:text-ink-1 active:scale-95 active:bg-surface-3 lg:size-8 lg:after:inset-0 [&::-webkit-details-marker]:hidden"
      >
        <Icon name="more" size={18} />
      </summary>

      {/* `max-w-[calc(100vw-2rem)]` — פאנל של 208px ממוקם מוחלט חורג
          מהמסך ב-360px כשהבורר יושב בקצה השורה */}
      <div
        role="menu"
        className="absolute end-0 top-full z-30 mt-1 w-52 max-w-[calc(100vw-2rem)] rounded-card border border-line bg-surface p-1 shadow-pop"
      >
        {items.map((item) =>
          item.href ? (
            <a
              key={item.label}
              role="menuitem"
              href={item.href}
              onClick={close}
              className={itemClass}
            >
              {item.icon && <Icon name={item.icon} size={14} className="shrink-0 text-ink-4" />}
              {item.label}
            </a>
          ) : (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                close();
                item.onSelect?.();
              }}
              className={itemClass}
            >
              {item.icon ? (
                <Icon name={item.icon} size={14} className="shrink-0 text-ink-4" />
              ) : (
                <span aria-hidden="true" className="w-3.5 shrink-0" />
              )}
              {item.label}
            </button>
          ),
        )}
      </div>
    </details>
  );
}
