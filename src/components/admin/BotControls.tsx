"use client";

import { useState, useTransition } from "react";
import {
  Badge,
  Button,
  Field,
  inputClass,
  useNow,
} from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { relative } from "@/lib/format";
import {
  cancelQueuedMessageAction,
  retryFailedMessageAction,
  setBotDailyCapAction,
  setBotPausedAction,
  setBotWindowAction,
} from "@/app/(app)/admin/botActions";

/**
 * לוח השליטה בבוט.
 *
 * הרצועה שמעל (`BotStatus`) עונה על "האם זה עובד". הלוח הזה עונה על
 * "מה לעשות עכשיו" — ובראש ובראשונה על **עצור**. עד עכשיו כל שינוי
 * בהתנהגות הבוט דרש `git push` ופריסה, וזה בסדר לשינוי נוסח; זה לא
 * בסדר כשמתברר שההודעה שיוצאת שגויה ועוד מאה כאלה ממתינות בתור.
 *
 * העצירה מנוסחת לכל אורך המסך כ"מושהה" ולא כ"כבוי": התור ממשיך
 * להתמלא, ומה שמצטבר יוצא כשמשחררים. זה לא ניואנס לשוני — זו
 * ההתנהגות בפועל, ומנהל שיחשוב שהוא איבד את התזכורות יימנע מלהשתמש
 * במתג בדיוק ברגע שבו הוא נחוץ.
 */

export interface QueuedMessage {
  id: string;
  toPhone: string;
  body: string;
  scheduledFor: string;
  recipientName: string | null;
}

export interface BotSettings {
  paused: boolean;
  pausedReason: string | null;
  pausedAt: string | null;
  sendWindowStartHour: number;
  sendWindowEndHour: number;
  dailyCap: number;
}

export function BotControls({
  settings,
  queued,
  sentToday,
}: {
  settings: BotSettings;
  queued: QueuedMessage[];
  sentToday: number;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "הפעולה נכשלה");
    });
  };

  return (
    <section className="mb-4 rounded-card border border-line bg-surface">
      <PauseBar
        settings={settings}
        pending={pending}
        onToggle={(reason) =>
          run(() => setBotPausedAction(!settings.paused, reason))
        }
      />

      {error && (
        <p className="border-t border-line px-3 py-2 text-xs text-bad" role="alert">
          {error}
        </p>
      )}

      <details className="border-t border-line">
        <summary className="cursor-pointer px-3 py-2.5 text-sm text-ink-2">
          הגדרות שליחה ותור
          <span className="ms-2 text-xs text-ink-4">
            {settings.sendWindowStartHour}:00–{settings.sendWindowEndHour}:00 ·{" "}
            <span className="nums">{sentToday}</span>
            {settings.dailyCap > 0 && (
              <>
                /<span className="nums">{settings.dailyCap}</span>
              </>
            )}{" "}
            היום
          </span>
        </summary>

        <div className="flex flex-col gap-4 px-3 pb-3">
          <WindowAndCap settings={settings} pending={pending} run={run} />
          <QueueList queued={queued} pending={pending} run={run} />
        </div>
      </details>
    </section>
  );
}

/* ── מתג ההשהיה ───────────────────────────────────────────────────────── */

function PauseBar({
  settings,
  pending,
  onToggle,
}: {
  settings: BotSettings;
  pending: boolean;
  onToggle: (reason?: string) => void;
}) {
  const now = useNow();
  const [reason, setReason] = useState("");

  if (settings.paused) {
    const since =
      now !== null && settings.pausedAt ? relative(settings.pausedAt, now) : "";

    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-e-2 border-e-warn bg-warn-soft px-3 py-2.5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-warn">
            <Icon name="pause" size={16} />
            השליחה מושהית
          </p>
          <p className="mt-0.5 text-xs text-ink-3">
            {settings.pausedReason ? `${settings.pausedReason} · ` : ""}
            {since && `הושהה ${since} · `}
            תזכורות ממשיכות להצטבר ויֵצאו כשתשוחרר
          </p>
        </div>

        <Button
          variant="primary"
          icon="play"
          className="h-9"
          disabled={pending}
          onClick={() => onToggle()}
        >
          חידוש שליחה
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink-1">השליחה פעילה</p>
        <p className="mt-0.5 text-xs text-ink-3">
          השהיה עוצרת שליחה מיידית. שום תזכורת לא נמחקת.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="סיבה (לא חובה)"
          className={`${inputClass} h-9 w-40`}
          aria-label="סיבת ההשהיה"
        />
        <Button
          variant="danger"
          icon="pause"
          className="h-9"
          disabled={pending}
          onClick={() => onToggle(reason)}
        >
          השהה
        </Button>
      </div>
    </div>
  );
}

/* ── חלון שליחה ותקרה ─────────────────────────────────────────────────── */

function WindowAndCap({
  settings,
  pending,
  run,
}: {
  settings: BotSettings;
  pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  const [from, setFrom] = useState(String(settings.sendWindowStartHour));
  const [to, setTo] = useState(String(settings.sendWindowEndHour));
  const [cap, setCap] = useState(String(settings.dailyCap));

  const windowDirty =
    Number(from) !== settings.sendWindowStartHour ||
    Number(to) !== settings.sendWindowEndHour;
  const capDirty = Number(cap) !== settings.dailyCap;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-md border border-line bg-surface-2 p-3">
        <Field
          label="חלון שליחה"
          hint="מחוץ לחלון תזכורות נדחות לבוקר, לא נמחקות"
        >
          <div className="flex items-center gap-2">
            <select
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={`${inputClass} nums`}
              aria-label="שעת פתיחה"
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>{`${h}:00`}</option>
              ))}
            </select>
            <span className="text-ink-4">–</span>
            <select
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={`${inputClass} nums`}
              aria-label="שעת סגירה"
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>{`${h}:00`}</option>
              ))}
            </select>
          </div>
        </Field>

        {windowDirty && (
          <Button
            variant="primary"
            className="mt-2 h-9 w-full"
            disabled={pending}
            onClick={() => run(() => setBotWindowAction(Number(from), Number(to)))}
          >
            שמירת החלון
          </Button>
        )}
      </div>

      <div className="rounded-md border border-line bg-surface-2 p-3">
        <Field
          label="תקרה יומית"
          hint="רשת ביטחון מפני לולאת שליחה. 0 = בלי תקרה"
        >
          <input
            type="number"
            min={0}
            max={10000}
            value={cap}
            onChange={(e) => setCap(e.target.value)}
            className={`${inputClass} nums`}
            aria-label="תקרת הודעות ליום"
          />
        </Field>

        {capDirty && (
          <Button
            variant="primary"
            className="mt-2 h-9 w-full"
            disabled={pending}
            onClick={() => run(() => setBotDailyCapAction(Number(cap)))}
          >
            שמירת התקרה
          </Button>
        )}
      </div>
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

/* ── התור ─────────────────────────────────────────────────────────────── */

function QueueList({
  queued,
  pending,
  run,
}: {
  queued: QueuedMessage[];
  pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  const now = useNow();

  if (queued.length === 0) {
    return (
      <p className="rounded-md border border-line bg-surface-2 px-3 py-4 text-center text-xs text-ink-4">
        אין תזכורות ממתינות
      </p>
    );
  }

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-ink-2">
        <span className="nums">{queued.length}</span> ממתינות בתור
      </p>

      <ul className="flex flex-col gap-1.5">
        {queued.map((m) => (
          <li
            key={m.id}
            className="flex items-start gap-2 rounded-md border border-line bg-surface-2 px-2.5 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-xs font-medium text-ink-1">
                {m.recipientName ?? "—"}
                <span className="ltr-num text-ink-4">{m.toPhone}</span>
                {now !== null && (
                  <Badge tone="neutral">{relative(m.scheduledFor, now)}</Badge>
                )}
              </p>
              {/* שורה ראשונה בלבד: הכותרת מזהה את סוג ההודעה, והגוף
                  המלא היה הופך את הרשימה לבלתי סריקה */}
              <p className="mt-0.5 truncate text-xs text-ink-4">
                {m.body.split("\n")[0]}
              </p>
            </div>

            <Button
              variant="ghost"
              className="h-8 shrink-0 px-2 text-xs"
              disabled={pending}
              onClick={() => run(() => cancelQueuedMessageAction(m.id))}
            >
              ביטול
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** כפתור ניסיון חוזר, לשימוש ברשימת הכשלים שב-`BotStatus`. */
export function RetryFailedButton({ id }: { id: string }) {
  const [pending, start] = useTransition();

  return (
    <Button
      variant="ghost"
      className="h-7 shrink-0 px-2 text-xs"
      disabled={pending}
      onClick={() => start(() => retryFailedMessageAction(id).then(() => {}))}
    >
      שלח שוב
    </Button>
  );
}
