import { NextResponse } from "next/server";

import { requireRouteAccess } from "@/server/auth/session";
import { writeMailerSettings } from "@/server/mailer/settings";

/**
 * שינוי התקרה היומית והקצב לתקתוק מהמסך.
 *
 * ⚠️ **קיים כדי שהמשתמש לא יהיה תלוי במפתח.** הערכים חיים במסד
 * מלכתחילה כדי שאפשר יהיה לשנות אותם בלי פריסה — אבל בלי פקד במסך
 * "בלי פריסה" עדיין אומר "בלי מישהו שיש לו גישה למסד", וזה אותו
 * עיכוב בדיוק.
 */

/** תקרה עליונה קשיחה. Gmail חוסם סביב 500, וחשבון שנשרף לא משוחזר. */
const MAX_DAILY = 450;

/** מעל זה גוגל רואה התפרצות, גם כשהתקרה היומית מרשה. */
const MAX_PER_TICK = 50;

function clamp(value: unknown, max: number): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(Math.floor(n), max);
}

export async function POST(request: Request): Promise<Response> {
  const user = await requireRouteAccess("/mailer");
  const body = (await request.json()) as {
    dailyCap?: unknown;
    perTick?: unknown;
  };

  const dailyCap = clamp(body.dailyCap, MAX_DAILY);
  const perTick = clamp(body.perTick, MAX_PER_TICK);

  if (dailyCap === null || perTick === null) {
    return NextResponse.json(
      { success: false, error: "ערכים לא תקינים" },
      { status: 400 },
    );
  }

  await writeMailerSettings({ dailyCap, perTick }, user.id);

  return NextResponse.json({ success: true, dailyCap, perTick });
}
