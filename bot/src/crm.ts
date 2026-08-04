import { CRM_BASE_URL, WA_API_KEY, INSTANCE_ID } from "./config.js";

/**
 * הדיבור עם ה-CRM. שתי קריאות, זה הכול.
 *
 * הבוט לא יודע מה זה ליד ולא מה זה תאריך חזרה — הוא מקבל מספר וטקסט
 * ומחזיר הצלחה או כישלון. כל ההיגיון חי בשרת.
 */

export interface OutboxMessage {
  id: string;
  toPhone: string;
  body: string;
}

export interface PullResponse {
  messages: OutboxMessage[];
  queued: number;
  recoveredAfterMinutes: number | null;
  /**
   * מנהל השהה את השליחה מהאתר. אופציונלי כי בוט שלא עודכן מדבר מול
   * שרת שכן — ובגרסה ישנה של השדה הזה פשוט אין.
   */
  paused?: boolean;
}

async function call<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${CRM_BASE_URL()}${path}`, {
    method: "POST",
    headers: { "x-api-key": WA_API_KEY(), "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${path} → ${res.status} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export function pull(
  waConnected: boolean,
  waNumber: string | undefined,
  limit = 5,
): Promise<PullResponse> {
  return call<PullResponse>("/api/whatsapp/pull", {
    instanceId: INSTANCE_ID,
    waConnected,
    waNumber,
    limit,
  });
}

export function report(
  results: { id: string; status: "sent" | "failed"; error?: string }[],
): Promise<{ applied: number }> {
  return call<{ applied: number }>("/api/whatsapp/report", { results });
}

/**
 * מדווח הודעות נכנסות ל-CRM.
 *
 * ⚠️ ה-CRM הוא שמפענח את הטקסט, לא הבוט. פענוח עברית חופשית ישתנה
 * הרבה, וכל שינוי בו צריך לעלות ב-`git push` ולא בנסיעה למחשב שבמשרד.
 */
export function reportInbound(
  messages: { id: string; fromPhone: string; body: string; timestamp: number }[],
): Promise<{ handled: number }> {
  return call<{ handled: number }>("/api/whatsapp/inbound", { messages });
}
