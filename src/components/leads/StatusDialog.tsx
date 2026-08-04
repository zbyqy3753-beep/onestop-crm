"use client";

import { useState } from "react";
import type { LeadStatus } from "@/lib/domain/types";
import { STATUS_CONFIG } from "@/lib/domain/types";
import { Button, Modal, inputClass } from "@/components/ui/primitives";

/**
 * נפתח כשסטטוס דורש פירוט.
 *
 * זו הנקודה שבה נוצרת היסטוריית הליד: בלי הפירוט, "לא מעוניין"
 * הוא מילה אחת שאי אפשר ללמוד ממנה כלום.
 */
export function StatusDialog({
  target,
  onCancel,
  onConfirm,
  busy,
}: {
  target: { leadIds: string[]; to: LeadStatus } | null;
  onCancel: () => void;
  onConfirm: (detail: string, followUpDate?: string) => void;
  busy: boolean;
}) {
  // מתאפס בין פתיחות דרך ה-key שההורה נותן, לא דרך effect
  const [detail, setDetail] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");

  if (!target) return null;

  const meta = STATUS_CONFIG[target.to];
  const prompt = meta.prompt;
  const many = target.leadIds.length > 1;
  const blocked = Boolean(prompt?.required) && !detail.trim();

  // סטטוסים ששומרים תזכורת חזרה — ראה changeStatus ברפוזיטורי.
  // הורחב מעבר ל"חיזור"/"חזרה ללקוח": אחרי "אין מענה" (וכד׳) הנציג
  // צריך לקבוע חזרה בלי לפתוח דיאלוג נוסף. התאריך נשאר אופציונלי.
  const FOLLOW_UP_STATUSES: LeadStatus[] = [
    "followUp",
    "futureTracking",
    "noAnswer",
    "contacted",
    "awaitingClient",
    "quoteSent",
  ];
  const wantsFollowUp = FOLLOW_UP_STATUSES.includes(target.to);

  return (
    <Modal
      open
      onClose={onCancel}
      title={many ? `עדכון ${target.leadIds.length} לידים` : "עדכון סטטוס"}
    >
      <p className="mb-3 text-sm text-ink-2">
        הסטטוס ישתנה ל
        <strong className="font-semibold text-ink-1">״{meta.label}״</strong>
        {many && ` עבור ${target.leadIds.length} לידים`}.
      </p>

      {prompt && (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-2">
            {prompt.question}
            {!prompt.required && (
              <span className="font-normal text-ink-4"> (אופציונלי)</span>
            )}
          </span>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder={prompt.placeholder}
            rows={3}
            autoFocus
            className={`${inputClass} resize-y`}
          />
        </label>
      )}

      {wantsFollowUp && (
        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-medium text-ink-2">
            תאריך חזרה
            <span className="font-normal text-ink-4"> (אופציונלי)</span>
          </span>
          {/* קיצורי דרך נפוצים — נגיעה אחת במקום גלילה בלוח שנה */}
          <div className="mb-2 flex gap-1.5">
            {FOLLOW_UP_PRESETS.map((preset) => {
              const date = inDays(preset.days);
              // רק היום מושווה, לא השעה — אחרת נגיעה בצ׳יפ שעה הייתה
              // מכבה את צ׳יפ היום שנבחר רגע לפניו
              const active = followUpDate.slice(0, 10) === date.slice(0, 10);
              return (
                <button
                  key={preset.days}
                  type="button"
                  // שומר שעה שכבר נבחרה; בלי בחירה — 09:00 של `inDays`
                  onClick={() =>
                    setFollowUpDate(
                      followUpDate ? withDay(followUpDate, date) : date,
                    )
                  }
                  aria-pressed={active}
                  className={`min-h-9 rounded-full border px-3 text-xs font-medium transition-colors active:scale-95 ${
                    active
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink-1"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          {/* שעות נפוצות — משנות רק את השעה ומשאירות את התאריך שנבחר */}
          <div className="mb-2 flex gap-1.5">
            {HOUR_PRESETS.map((hour) => {
              const active = followUpDate.endsWith(`T${hour}`);
              return (
                <button
                  key={hour}
                  type="button"
                  onClick={() => setFollowUpDate(withHour(followUpDate, hour))}
                  aria-pressed={active}
                  className={`nums min-h-9 rounded-full border px-3 text-xs font-medium transition-colors active:scale-95 ${
                    active
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink-1"
                  }`}
                >
                  {hour}
                </button>
              );
            })}
          </div>
          <input
            type="datetime-local"
            step={900}
            value={followUpDate}
            // תחילת היום ולא 09:00 — אחרת אי אפשר לקבוע חזרה להיום ב-08:00
            min={`${today().slice(0, 10)}T00:00`}
            onChange={(e) => setFollowUpDate(e.target.value)}
            className={`${inputClass} nums`}
          />
          <span className="mt-1 block text-xs text-ink-4">
            הליד יופיע בתצוגה ״לחזור היום״, והעובד המשויך יקבל תזכורת
            בוואטסאפ בשעה שנבחרה.
          </span>
        </label>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onCancel} disabled={busy}>
          ביטול
        </Button>
        <Button
          variant="primary"
          onClick={() => onConfirm(detail, followUpDate || undefined)}
          disabled={busy || blocked}
        >
          {busy ? "שומר…" : "עדכון"}
        </Button>
      </div>
    </Modal>
  );
}

/** ברירת המחדל של צ׳יפי התאריך — תחילת יום עבודה. */
const DEFAULT_HOUR = "09:00";

/** השעות שסוכן באמת בוחר: פתיחה, לפני הצהריים, אחרי, וסוף יום. */
const HOUR_PRESETS = ["09:00", "12:00", "16:00", "18:00"];

/**
 * עכשיו בפורמט של `<input type="datetime-local">`, בשעון המקומי.
 * `toISOString()` היה מחזיר UTC ובישראל זה נופל ליום הקודם בלילה.
 */
function today(): string {
  return inDays(0);
}

/**
 * תאריך בעוד `days` ימים ב-09:00, באותו פורמט ובאותו שעון מקומי —
 * `setDate` מטפל בגלישת חודש/שנה בעצמו.
 */
function inDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${DEFAULT_HOUR}`;
}

/**
 * מחליף רק את השעה ומשאיר את התאריך. כשעדיין לא נבחר תאריך — היום,
 * כדי שנגיעה בצ׳יפ שעה לבדה תיתן ערך שלם ולא שדה חצי-מלא.
 */
function withHour(value: string, hour: string): string {
  const day = value.slice(0, 10) || today().slice(0, 10);
  return `${day}T${hour}`;
}

/** מחליף רק את היום ומשאיר את השעה שכבר נבחרה. */
function withDay(value: string, dayValue: string): string {
  const hour = value.slice(11) || DEFAULT_HOUR;
  return `${dayValue.slice(0, 10)}T${hour}`;
}

// קיצורי הדרך שמעל שדה התאריך
const FOLLOW_UP_PRESETS = [
  { label: "מחר", days: 1 },
  { label: "בעוד 3 ימים", days: 3 },
  { label: "שבוע הבא", days: 7 },
] as const;
