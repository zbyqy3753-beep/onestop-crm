import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * שני מפתחות לשני צדדים של תור ההקלטות.
 *
 * `CALLS_PHONE_KEY`  — האפליקציה בטלפון של אלירן: מעלה הקלטות וקוראת סיכומים.
 * `CALLS_WORKER_KEY` — המחשב במשרד: מושך שמע ומחזיר תמליל וניתוח.
 *
 * ⚠️ מפתחות נפרדים בכוונה. טלפון שאבד לא אמור לאפשר הורדה של שמע
 * שעוד לא נמחק, והמחשב לא צריך יכולת להעלות הקלטות.
 */
export type CallsRole = "phone" | "worker";

const ENV: Record<CallsRole, string> = {
  phone: "CALLS_PHONE_KEY",
  worker: "CALLS_WORKER_KEY",
};

export function callsAuthorized(request: Request, role: CallsRole): boolean {
  const secret = process.env[ENV[role]]?.trim();
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const callsUnauthorized = () =>
  NextResponse.json({ success: false, error: "אימות נכשל" }, { status: 401 });

/** גודל חתיכת שמע מקסימלי. מתחת לתקרת 4.5MB של Vercel, עם מרווח. */
export const MAX_CHUNK_BYTES = 3 * 1024 * 1024;
/** הקלטה של יותר משעתיים היא כנראה תקלה ולא שיחה. */
export const MAX_CHUNKS = 40;
