"use client";

import type { Lead, LeadStatus, Priority } from "@/lib/domain/types";
import {
  PRIORITY_CONFIG,
  PRIORITY_ORDER,
  STATUS_CONFIG,
} from "@/lib/domain/types";
import { TONE_VAR, phone, relative, until } from "@/lib/format";
import { dayKey } from "@/lib/tz";
import type { LeadPatch } from "@/app/(app)/leads/actions";
import { Badge } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import {
  FollowUpCell,
  InlinePicker,
  RowActions,
  StarToggle,
  StatusPicker,
} from "./cells";

/**
 * ליד אחד ככרטיס — תצוגת הטלפון.
 *
 * הכרטיס **אינו** נגזר מ-`columns.ts`. `COLUMNS` הוא מודל צפיפות של
 * טבלה רחבה, ובורר העמודות הוא כלי של שולחן; כרטיס הוא פריסה מעוצבת
 * ביד. מה שכן משותף הוא הפקדים עצמם (`StatusPicker`, `InlinePicker`,
 * `RowActions`…) — אותם רכיבים בדיוק שהשורה משתמשת בהם, כך שהתנהגות
 * העריכה זהה בשתי התצוגות ואין שני מימושים שיכולים להיפרד.
 *
 * מה שעל הכרטיס עונה על שאלה אחת: **למי אני מתקשר עכשיו.** שם, טלפון,
 * סטטוס, עדיפות, מתי לחזור, וארבע דרכי הקשר.
 *
 * מה שלא עליו — קטגוריה, עלות, שיוך, פעילות, מקור, ספק, עיר, אימייל —
 * נמצא במגירה, שכבר היום נפתחת כגיליון מסך-מלא ב-390px. זו לא פשרה:
 * שתי רמות מידע, לא אחת מקוצצת.
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
  onStar,
  onPatch,
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
  onStar: (next: boolean) => void;
  onPatch: (patch: LeadPatch) => void;
}) {
  const priority = PRIORITY_CONFIG[lead.priority];
  const status = STATUS_CONFIG[lead.status];

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
          <span className="ltr-num mt-0.5 block text-[13px] text-ink-3">
            {phone(lead.phone)}
          </span>
        </button>

        {/* מתי נגעו בו לאחרונה — מסביר למה הוא במקום שהוא בו בתור */}
        <span className="shrink-0 whitespace-nowrap pt-0.5 text-[11px] text-ink-4">
          {now === null ? "" : relative(lead.updatedAt, now)}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <StatusPicker current={lead.status} onPick={onStatus} />

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
          value={lead.followUpAt ? dayKey(Date.parse(lead.followUpAt)) : ""}
          busy={busy}
          onPick={(v) => onPatch({ followUpDate: v || null })}
        >
          {lead.followUpAt && now !== null ? (
            <span className="flex items-center gap-1 text-xs text-warn">
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
      </div>

      {/* פעולות הקשר — הסיבה שהמסך הזה נפתח בטלפון מלכתחילה */}
      {!selecting && (
        <div className="mt-1.5 border-t border-line pt-1.5">
          <RowActions lead={lead} onOpen={onOpen} />
        </div>
      )}
    </li>
  );
}
