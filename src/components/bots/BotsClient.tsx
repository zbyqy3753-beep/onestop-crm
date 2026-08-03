"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Field, inputClass, useNow } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { phone as formatPhone, relative } from "@/lib/format";
import { ROLE_CONFIG } from "@/lib/domain/types";
import type { BotOverview, MessageRow, RecipientRow } from "@/server/whatsapp/overview";
import {
  cancelQueuedMessageAction,
  retryFailedMessageAction,
  setBotDailyCapAction,
  setBotLeadMinutesAction,
  setBotPausedAction,
  setBotWindowAction,
} from "@/app/(app)/admin/botActions";

/**
 * מסך הבוטים.
 *
 * מה שהיה רצועה ב-`/admin` הפך למסך: מצב, מונים, הגדרות, התור,
 * ההיסטוריה, הכשלים ומי בכלל מקבל. הרעיון המנחה הוא שכל שאלה שנשאלת
 * על הבוט ("למה X לא קיבל?", "מה יצא היום?", "מה נשלח בפועל?") תיענה
 * כאן ולא בגישה למסד.
 */

type ActionRes = Promise<{ ok: boolean; error?: string }>;

export function BotsClient({ overview }: { overview: BotOverview }) {
  const { settings, health, counts, queue, recent, failures, recipients } = overview;
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("queue");

  const run = (fn: () => ActionRes) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "הפעולה נכשלה");
    });
  };

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-5 sm:px-6">
      <header className="mb-4">
        <h1 className="font-display text-[30px] font-bold leading-none tracking-tight">
          בוטים
        </h1>
        <p className="mt-2 text-sm text-ink-3">
          בוט תזכורות הוואטסאפ — מצב, הגדרות ותור השליחה
        </p>
      </header>

      <HealthPanel health={health} paused={settings.paused} />

      <Counters counts={counts} />

      <PauseBar
        settings={settings}
        pending={pending}
        onToggle={(reason) => run(() => setBotPausedAction(!settings.paused, reason))}
      />

      <SettingsGrid settings={settings} pending={pending} run={run} />

      {error && (
        <p
          className="mt-3 rounded-card border border-bad/30 bg-bad-soft px-3 py-2 text-sm text-bad"
          role="alert"
        >
          {error}
        </p>
      )}

      <Tabs
        tab={tab}
        onTab={setTab}
        counts={{
          queue: queue.length,
          recent: recent.length,
          failures: failures.length,
          recipients: recipients.length,
        }}
      />

      <div className="mt-3">
        {tab === "queue" && (
          <MessageList
            rows={queue}
            empty="אין הודעות ממתינות"
            timeLabel="יוצא"
            timeOf={(m) => m.scheduledFor}
            action={(m) => (
              <Button
                variant="ghost"
                className="h-8 shrink-0 px-2 text-xs"
                disabled={pending}
                onClick={() => run(() => cancelQueuedMessageAction(m.id))}
              >
                ביטול
              </Button>
            )}
          />
        )}

        {tab === "recent" && (
          <MessageList
            rows={recent}
            empty="עדיין לא נשלחו הודעות"
            timeLabel="נשלח"
            timeOf={(m) => m.sentAt ?? m.scheduledFor}
          />
        )}

        {tab === "failures" && (
          <MessageList
            rows={failures}
            empty="אין כשלים"
            timeLabel="היה אמור"
            timeOf={(m) => m.scheduledFor}
            action={(m) => (
              <Button
                variant="secondary"
                className="h-8 shrink-0 px-2 text-xs"
                disabled={pending}
                onClick={() => run(() => retryFailedMessageAction(m.id))}
              >
                שלח שוב
              </Button>
            )}
          />
        )}

        {tab === "recipients" && <Recipients rows={recipients} />}
      </div>
    </div>
  );
}

/* ── מצב החיבור ───────────────────────────────────────────────────────── */

const AMBER_AFTER_MS = 3 * 60_000;
const RED_AFTER_MS = 10 * 60_000;

type Tone = "good" | "warn" | "bad" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  good: "border-good/30 bg-good-soft text-good",
  warn: "border-warn/30 bg-warn-soft text-warn",
  bad: "border-bad/30 bg-bad-soft text-bad",
  neutral: "border-line bg-surface-2 text-ink-3",
};

function HealthPanel({
  health,
  paused,
}: {
  health: BotOverview["health"];
  paused: boolean;
}) {
  const now = useNow();

  if (!health) {
    return (
      <div className={`mb-3 rounded-card border px-3 py-3 ${TONE_CLASS.neutral}`}>
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Icon name="whatsapp" size={18} />
          הבוט עדיין לא חובר
        </p>
        <p className="mt-1 text-xs opacity-80">
          עד שיחובר, תזכורות חזרה לא נשלחות. ראו docs/whatsapp-bot.md.
        </p>
      </div>
    );
  }

  const sinceMs = now === null ? 0 : now - Date.parse(health.lastSeenAt);
  const seen = now === null ? "" : relative(health.lastSeenAt, now);
  const duration = seen.replace(/^לפני /, "");

  const tone: Tone =
    now === null
      ? "neutral"
      : sinceMs > RED_AFTER_MS
        ? "bad"
        : sinceMs > AMBER_AFTER_MS || !health.waConnected
          ? "warn"
          : paused
            ? "neutral"
            : "good";

  const title =
    tone === "bad"
      ? `הבוט לא נראה כבר ${duration} — תזכורות לא נשלחות`
      : !health.waConnected
        ? "הבוט פעיל אך וואטסאפ מנותק"
        : tone === "warn"
          ? `הבוט לא דיווח כבר ${duration}`
          : paused
            ? "הבוט מחובר · השליחה מושהית"
            : `הבוט מחובר · נראה ${seen}`;

  return (
    <div className={`mb-3 rounded-card border px-3 py-3 ${TONE_CLASS[tone]}`}>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Icon name="whatsapp" size={18} />
        {title}
      </p>

      <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs opacity-90">
        <Meta label="שולח מ" value={health.waNumber ? `+${health.waNumber}` : "—"} ltr />
        <Meta label="מופע" value={health.instanceId ?? "—"} ltr />
        <Meta label="דופק אחרון" value={seen || "—"} />
      </dl>
    </div>
  );
}

function Meta({
  label,
  value,
  ltr,
}: {
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div className="flex gap-1.5">
      <dt className="opacity-70">{label}:</dt>
      <dd className={ltr ? "ltr-num font-medium" : "font-medium"}>{value}</dd>
    </div>
  );
}

/* ── מונים ────────────────────────────────────────────────────────────── */

function Counters({ counts }: { counts: BotOverview["counts"] }) {
  const tiles: { label: string; value: number; tone?: Tone }[] = [
    { label: "בתור", value: counts.queued },
    { label: "בשליחה", value: counts.sending },
    { label: "נשלחו היום", value: counts.sentToday, tone: "good" },
    { label: "נכשלו היום", value: counts.failedToday, tone: counts.failedToday > 0 ? "bad" : undefined },
    { label: "בוטלו היום", value: counts.cancelledToday },
    { label: "נשלחו השבוע", value: counts.sentWeek },
  ];

  return (
    <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="rounded-card border border-line bg-surface px-2.5 py-2 text-center"
        >
          <p
            className={`nums text-xl font-bold leading-none ${
              t.tone === "good"
                ? "text-good"
                : t.tone === "bad"
                  ? "text-bad"
                  : "text-ink-1"
            }`}
          >
            {t.value}
          </p>
          <p className="mt-1 text-[11px] leading-tight text-ink-4">{t.label}</p>
        </div>
      ))}
    </div>
  );
}

/* ── השהיה ────────────────────────────────────────────────────────────── */

function PauseBar({
  settings,
  pending,
  onToggle,
}: {
  settings: BotOverview["settings"];
  pending: boolean;
  onToggle: (reason?: string) => void;
}) {
  const now = useNow();
  const [reason, setReason] = useState("");

  if (settings.paused) {
    const since =
      now !== null && settings.pausedAt
        ? relative(settings.pausedAt.toISOString(), now)
        : "";

    return (
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-card border border-warn/30 bg-warn-soft px-3 py-2.5">
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
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface px-3 py-2.5">
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

/* ── הגדרות ───────────────────────────────────────────────────────────── */

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function SettingsGrid({
  settings,
  pending,
  run,
}: {
  settings: BotOverview["settings"];
  pending: boolean;
  run: (fn: () => ActionRes) => void;
}) {
  const [from, setFrom] = useState(String(settings.sendWindowStartHour));
  const [to, setTo] = useState(String(settings.sendWindowEndHour));
  const [lead, setLead] = useState(String(settings.reminderLeadMinutes));
  const [cap, setCap] = useState(String(settings.dailyCap));

  const windowDirty =
    Number(from) !== settings.sendWindowStartHour ||
    Number(to) !== settings.sendWindowEndHour;
  const leadDirty = Number(lead) !== settings.reminderLeadMinutes;
  const capDirty = Number(cap) !== settings.dailyCap;

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <Card>
        <Field label="חלון שליחה" hint="מחוצה לו תזכורות נדחות לבוקר">
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
          <Save
            pending={pending}
            onClick={() => run(() => setBotWindowAction(Number(from), Number(to)))}
          />
        )}
      </Card>

      <Card>
        <Field
          label="הקדמת תזכורת"
          hint="דקות לפני מועד החזרה. 0 = בדיוק בשעה"
        >
          <input
            type="number"
            min={0}
            max={180}
            value={lead}
            onChange={(e) => setLead(e.target.value)}
            className={`${inputClass} nums`}
            aria-label="דקות הקדמה"
          />
        </Field>
        {leadDirty && (
          <Save
            pending={pending}
            onClick={() => run(() => setBotLeadMinutesAction(Number(lead)))}
          />
        )}
      </Card>

      <Card>
        <Field label="תקרה יומית" hint="רשת ביטחון. 0 = בלי תקרה">
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
          <Save
            pending={pending}
            onClick={() => run(() => setBotDailyCapAction(Number(cap)))}
          />
        )}
      </Card>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-surface p-3">{children}</div>
  );
}

function Save({ pending, onClick }: { pending: boolean; onClick: () => void }) {
  return (
    <Button
      variant="primary"
      className="mt-2 h-9 w-full"
      disabled={pending}
      onClick={onClick}
    >
      שמירה
    </Button>
  );
}

/* ── לשוניות ──────────────────────────────────────────────────────────── */

type TabKey = "queue" | "recent" | "failures" | "recipients";

const TAB_LABEL: Record<TabKey, string> = {
  queue: "בתור",
  recent: "נשלחו",
  failures: "כשלים",
  recipients: "נמענים",
};

function Tabs({
  tab,
  onTab,
  counts,
}: {
  tab: TabKey;
  onTab: (t: TabKey) => void;
  counts: Record<TabKey, number>;
}) {
  return (
    <div
      className="mt-5 flex gap-1 overflow-x-auto border-b border-line"
      role="tablist"
    >
      {(Object.keys(TAB_LABEL) as TabKey[]).map((k) => (
        <button
          key={k}
          role="tab"
          aria-selected={tab === k}
          onClick={() => onTab(k)}
          className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            tab === k
              ? "border-brand text-ink-1"
              : "border-transparent text-ink-3 hover:text-ink-1"
          }`}
        >
          {TAB_LABEL[k]}
          <span className="nums ms-1.5 text-xs text-ink-4">{counts[k]}</span>
        </button>
      ))}
    </div>
  );
}

/* ── רשימת הודעות ─────────────────────────────────────────────────────── */

function MessageList({
  rows,
  empty,
  timeLabel,
  timeOf,
  action,
}: {
  rows: MessageRow[];
  empty: string;
  timeLabel: string;
  timeOf: (m: MessageRow) => string;
  action?: (m: MessageRow) => React.ReactNode;
}) {
  const now = useNow();

  if (rows.length === 0) {
    return (
      <p className="rounded-card border border-line bg-surface px-3 py-6 text-center text-sm text-ink-4">
        {empty}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((m) => (
        <li key={m.id} className="rounded-card border border-line bg-surface">
          <div className="flex items-start gap-2 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-ink-1">
                {m.recipientName ?? "—"}
                <span className="ltr-num text-xs text-ink-4">{m.toPhone}</span>
                {m.leadName && <Badge tone="neutral">{m.leadName}</Badge>}
                {m.attempts > 1 && (
                  <Badge tone="warn">
                    <span className="nums">{m.attempts}</span> ניסיונות
                  </Badge>
                )}
              </p>

              <p className="mt-0.5 text-xs text-ink-4">
                {timeLabel}{" "}
                {now !== null ? relative(timeOf(m), now) : ""}
              </p>

              {m.lastError && (
                <p className="mt-1 text-xs text-bad">{m.lastError}</p>
              )}
            </div>

            {action?.(m)}
          </div>

          <details className="border-t border-line">
            <summary className="cursor-pointer px-3 py-1.5 text-xs text-ink-3">
              ההודעה המלאה
            </summary>
            {/* `whitespace-pre-wrap` — זה הטקסט המדויק שיוצא לוואטסאפ,
                כולל שבירות השורה שמעצבות אותו שם */}
            <p className="whitespace-pre-wrap border-t border-line bg-surface-2 px-3 py-2 text-xs leading-relaxed text-ink-2">
              {m.body}
            </p>
          </details>
        </li>
      ))}
    </ul>
  );
}

/* ── נמענים ───────────────────────────────────────────────────────────── */

/**
 * מי מקבל תזכורות ומי לא.
 *
 * ⚠️ הטבלה הזו קיימת בגלל כשל שקט: עובד בלי טלפון תקין פשוט מדולג,
 * בלי שגיאה ובלי סימן. עד עכשיו הדרך היחידה לגלות זאת הייתה שמישהו
 * יתלונן שהוא לא מקבל.
 */
function Recipients({ rows }: { rows: RecipientRow[] }) {
  const blind = rows.filter((r) => !r.phone || r.phoneInvalid);

  return (
    <div>
      {blind.length > 0 && (
        <p className="mb-2 rounded-card border border-warn/30 bg-warn-soft px-3 py-2 text-xs text-warn">
          <span className="nums font-semibold">{blind.length}</span> עובדים
          פעילים לא יקבלו תזכורות — אין להם מספר תקין. תיקון במסך ניהול המערכת.
        </p>
      )}

      <ul className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-2 rounded-card border border-line bg-surface px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-ink-1">
                {r.name}
                <span className="text-xs font-normal text-ink-4">
                  {ROLE_CONFIG[r.role as keyof typeof ROLE_CONFIG]?.label ?? r.role}
                </span>
                {!r.phone ? (
                  <Badge tone="warn">אין טלפון</Badge>
                ) : r.phoneInvalid ? (
                  <Badge tone="bad">מספר לא תקין</Badge>
                ) : null}
              </p>

              <p className="mt-0.5 text-xs text-ink-4">
                {r.phone ? (
                  <span className="ltr-num">{formatPhone(r.phone)}</span>
                ) : (
                  "—"
                )}
                {" · "}
                <span className="nums">{r.openLeadsWithFollowUp}</span> לידים עם
                תאריך חזרה
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
