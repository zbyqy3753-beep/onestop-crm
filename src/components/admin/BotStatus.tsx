"use client";

import Link from "next/link";
import { useNow } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { relative } from "@/lib/format";

/**
 * רצועת מצב בוט תזכורות הוואטסאפ, במסך ניהול המערכת.
 *
 * הבוט רץ על מחשב במשרד שאף אחד לא מסתכל עליו, והכשל השקט הוא
 * המסוכן: "לא הגיעו תזכורות" ו"לא היו תזכורות" נראים בדיוק אותו דבר.
 *
 * ⚠️ זו **רק** הרצועה. ההגדרות, התור, ההיסטוריה והנמענים עברו למסך
 * `/bots` — הם גדלו מעבר למה שמסך המשתמשים אמור להחזיק. הרצועה נשארה
 * כאן כי היא התשובה ל"האם משהו דורש את תשומת ליבי", ומסך הניהול הוא
 * המקום שנפתח כדי לשאול את זה.
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

const AMBER_AFTER_MS = 3 * 60_000;
const RED_AFTER_MS = 10 * 60_000;

export function BotStatus({
  health,
  failureCount = 0,
  paused = false,
  queuedCount = 0,
}: {
  health: BotHealth | null;
  failureCount?: number;
  /** מנהל השהה את השליחה — הרצועה לא תתיימר להיות ירוקה */
  paused?: boolean;
  queuedCount?: number;
}) {
  // אותו דפוס כמו בכל תצוגת זמן יחסי במערכת — שעון מהלקוח, אחרי
  // ההרכבה, כדי שהשרת והלקוח לא ירנדרו טקסט שונה
  const now = useNow();

  if (!health?.lastSeenAt) {
    return (
      <Strip
        tone="neutral"
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
          : // השהיה ידנית אינה תקלה, אבל היא גם לא "עובד"
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
            ? "הבוט מחובר · השליחה מושהית"
            : `הבוט מחובר · נראה ${seen}`;

  const details = [
    health.waNumber ? `שולח מ-${health.waNumber}` : null,
    queuedCount > 0 ? `${queuedCount} תזכורות בתור` : null,
    failureCount > 0 ? `${failureCount} כשלים` : null,
  ].filter(Boolean);

  return <Strip tone={tone} title={title} body={details.join(" · ")} />;
}

type Tone = "good" | "warn" | "bad" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  good: "border-good/30 bg-good-soft text-good",
  warn: "border-warn/30 bg-warn-soft text-warn",
  bad: "border-bad/30 bg-bad-soft text-bad",
  neutral: "border-line bg-surface-2 text-ink-3",
};

/**
 * הרצועה כולה קישור ל-`/bots`.
 *
 * כשהיא אדומה השאלה הבאה תמיד אותה שאלה — "מה קרה ומה עושים" —
 * ולחיצה על מה שהתריע היא המקום שמחפשים בו את התשובה.
 */
function Strip({
  tone,
  title,
  body,
}: {
  tone: Tone;
  title: string;
  body?: string;
}) {
  return (
    <Link
      href="/bots"
      className={`mb-4 flex items-center gap-2.5 rounded-card border px-3 py-2.5 transition-opacity hover:opacity-90 ${TONE_CLASS[tone]}`}
    >
      <Icon name="whatsapp" size={18} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {body && <p className="truncate text-xs opacity-80">{body}</p>}
      </div>
      <Icon name="chevronLeft" size={16} className="shrink-0 opacity-60" />
    </Link>
  );
}
