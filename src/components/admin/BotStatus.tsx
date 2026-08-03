"use client";

import { useNow } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { relative } from "@/lib/format";
import { RetryFailedButton } from "./BotControls";

/**
 * רצועת מצב בוט תזכורות הוואטסאפ.
 *
 * הבוט רץ על מחשב במשרד שאף אחד לא מסתכל עליו, והכשל השקט הוא
 * המסוכן: "לא הגיעו תזכורות" ו"לא היו תזכורות" נראים בדיוק אותו דבר.
 * הרצועה הזו היא המקום היחיד שבו ההבדל נראה.
 *
 * שלושה מצבים, לפי הזמן מאז הדופק האחרון — הבוט מדווח כל 60 שניות:
 *   ירוק  <3 דק׳  מחובר ועובד
 *   ענבר  3–10 דק׳ או וואטסאפ מנותק — התהליך חי אבל לא שולח
 *   אדום  >10 דק׳  התהליך לא רץ. תזכורות לא יוצאות.
 */

export interface BotHealth {
  lastSeenAt: string | null;
  waConnected: boolean;
  waNumber: string | null;
  instanceId: string | null;
  queuedCount: number;
}

export interface BotFailure {
  id: string;
  toPhone: string;
  lastError: string | null;
  scheduledFor: string;
}

const AMBER_AFTER_MS = 3 * 60_000;
const RED_AFTER_MS = 10 * 60_000;

export function BotStatus({
  health,
  failures,
  paused = false,
}: {
  health: BotHealth | null;
  failures: BotFailure[];
  /** מנהל השהה את השליחה — הרצועה לא תתיימר להיות ירוקה */
  paused?: boolean;
}) {
  // אותו דפוס כמו בכל תצוגת זמן יחסי במערכת — שעון מהלקוח, אחרי
  // ההרכבה, כדי שהשרת והלקוח לא ירנדרו טקסט שונה
  const now = useNow();

  if (!health?.lastSeenAt) {
    return (
      <Strip
        tone="neutral"
        icon="whatsapp"
        title="בוט התזכורות עדיין לא חובר"
        body="עד שהוא יחובר, תזכורות חזרה לא נשלחות בוואטסאפ."
      />
    );
  }

  const sinceMs = now === null ? 0 : now - Date.parse(health.lastSeenAt);
  const seen = now === null ? "" : relative(health.lastSeenAt, now);
  // "לפני 12 דק׳" נכון ל"נראה", אבל "לא נראה לפני 12 דק׳" אומר את
  // ההפך מהכוונה. במצבי הכשל מדובר במשך ולא בנקודת זמן.
  const duration = seen.replace(/^לפני /, "");

  const tone: Tone =
    now === null
      ? "neutral"
      : sinceMs > RED_AFTER_MS
        ? "bad"
        : sinceMs > AMBER_AFTER_MS || !health.waConnected
          ? "warn"
          : // השהיה ידנית אינה תקלה, אבל היא גם לא "עובד". ניטרלי ולא
            // ענבר כדי לא להציב שתי רצועות אזהרה זו מעל זו — לוח
            // השליטה שמתחת כבר צועק את זה בצבע.
            paused
            ? "neutral"
            : "good";

  const title =
    tone === "bad"
      ? `הבוט לא נראה כבר ${duration} — תזכורות לא נשלחות`
      : tone === "warn" && !health.waConnected
        ? "הבוט פעיל אך וואטסאפ מנותק"
        : tone === "warn"
          ? `הבוט לא דיווח כבר ${duration}`
          : paused
            ? `הבוט מחובר · השליחה מושהית`
            : `הבוט מחובר · נראה ${seen}`;

  const details = [
    health.waNumber ? `שולח מ-${health.waNumber}` : null,
    health.queuedCount > 0 ? `${health.queuedCount} תזכורות בתור` : null,
    health.instanceId,
  ].filter(Boolean);

  return (
    <div className="mb-4">
      <Strip
        tone={tone}
        icon="whatsapp"
        title={title}
        body={details.join(" · ")}
      />

      {failures.length > 0 && (
        <details className="mt-2 rounded-card border border-line bg-surface px-3 py-2">
          <summary className="cursor-pointer text-xs text-ink-3">
            {failures.length} תזכורות שנכשלו לאחרונה
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {failures.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-2 text-xs text-ink-4"
              >
                <span className="ltr-num shrink-0">{f.toPhone}</span>
                <span className="min-w-0 flex-1 truncate">
                  {f.lastError ?? "—"}
                </span>
                <RetryFailedButton id={f.id} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

type Tone = "good" | "warn" | "bad" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  good: "border-good/30 bg-good-soft text-good",
  warn: "border-warn/30 bg-warn-soft text-warn",
  bad: "border-bad/30 bg-bad-soft text-bad",
  neutral: "border-line bg-surface-2 text-ink-3",
};

function Strip({
  tone,
  icon,
  title,
  body,
}: {
  tone: Tone;
  icon: "whatsapp";
  title: string;
  body?: string;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-card border px-3 py-2.5 ${TONE_CLASS[tone]}`}
      role="status"
    >
      <Icon name={icon} size={18} />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        {body && <p className="truncate text-xs opacity-80">{body}</p>}
      </div>
    </div>
  );
}
