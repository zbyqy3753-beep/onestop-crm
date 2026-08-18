"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Field, inputClass } from "@/components/ui/primitives";
import {
  requestCode,
  submitCode,
  type ForgotState,
} from "@/app/forgot-password/actions";
import { CODE_LENGTH } from "@/lib/resetCode";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";

/**
 * שני שלבים במסך אחד.
 *
 * ⚠️ שני `useActionState` נפרדים ולא אחד עם ענף: כל שלב הוא פעולה
 * אחרת עם ולידציה אחרת, ומיזוגם לפעולה אחת היה מייצר שדות שקיימים
 * רק לפעמים — הדרך הקצרה ביותר לשלוח שלב אחד עם נתוני השני.
 */
export function ForgotPasswordForm() {
  const [reqState, reqAction, reqPending] = useActionState<ForgotState, FormData>(
    requestCode,
    { step: "request" },
  );

  if (reqState.step === "request") {
    return (
      <div className="rounded-xl border border-line bg-surface p-6">
        <p className="mb-5 text-sm text-ink-2">
          המסך הזה מיועד למי שההנהלה איפסה לו את הסיסמה. נשלח קוד בן
          {CODE_LENGTH} ספרות לוואטסאפ שרשום עליו במערכת.
        </p>

        <form action={reqAction} className="space-y-4">
          <Field label="שם משתמש" error={reqState.error}>
            <input
              name="loginId"
              type="text"
              autoComplete="username"
              dir="ltr"
              className={`${inputClass} text-start`}
              placeholder="idan"
            />
          </Field>

          <Button type="submit" variant="primary" disabled={reqPending} className="w-full py-2">
            {reqPending ? "שולח…" : "שלח קוד"}
          </Button>
        </form>

        <Link
          href="/login"
          className="mt-4 block text-center text-sm text-ink-4 hover:text-ink-2 hover:underline"
        >
          חזרה לכניסה
        </Link>
      </div>
    );
  }

  // `requestCode` לעולם לא מחזיר `done` — הצמצום כאן הוא בשביל
  // המהדר, לא בשביל זרימה אפשרית.
  if (reqState.step !== "verify") return null;

  return <VerifyStep loginId={reqState.loginId} maskedPhone={reqState.maskedPhone} />;
}

function VerifyStep({
  loginId,
  maskedPhone,
}: {
  loginId: string;
  maskedPhone?: string;
}) {
  const [state, action, pending] = useActionState<ForgotState, FormData>(
    submitCode,
    { step: "verify", loginId },
  );

  if (state.step === "done") {
    return (
      <div className="rounded-xl border border-line bg-surface p-6 text-center">
        <p className="font-semibold text-ink">הסיסמה נקבעה</p>
        <p className="mt-2 text-sm text-ink-3">מעכשיו נכנסים איתה.</p>
        <Link
          href="/login"
          className="mt-5 inline-block w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
        >
          למסך הכניסה
        </Link>
      </div>
    );
  }

  const error = state.step === "verify" ? state.error : undefined;

  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      {/* ⚠️ שתי הודעות שונות, ובכוונה. מי שקיבל קוד רואה לאן הוא הלך —
          אחרת הוא ממתין להודעה שלא תגיע כי הטלפון בכרטיס שלו שגוי.
          מי שלא זכאי רואה משפט כללי שלא מגלה אם החשבון קיים בכלל. */}
      {maskedPhone ? (
        <p className="mb-1 text-sm text-ink-2">
          נשלח קוד לוואטסאפ שמסתיים ב-
          <span dir="ltr" className="mx-1 font-semibold text-ink">
            {maskedPhone}
          </span>
        </p>
      ) : (
        <p className="mb-1 text-sm text-ink-2">
          אם החשבון זכאי לאיפוס, נשלח אליו קוד בוואטסאפ.
        </p>
      )}
      <p className="mb-5 text-xs text-ink-4">הקוד תקף לעשר דקות.</p>

      <form action={action} className="space-y-4">
        <input type="hidden" name="loginId" value={loginId} />

        <Field label="הקוד מהוואטסאפ">
          <input
            name="code"
            /* ⚠️ `inputMode` ולא `type="number"`: מקלדת ספרות בנייד, בלי
               החצים והגלגלת של שדה מספרי — ובלי לאבד אפס מוביל. */
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            dir="ltr"
            className={`${inputClass} text-start tracking-[0.4em]`}
            placeholder="000000"
          />
        </Field>

        <Field label="סיסמה חדשה">
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            dir="ltr"
            className={`${inputClass} text-start`}
            placeholder={"•".repeat(MIN_PASSWORD_LENGTH)}
          />
        </Field>

        <Field label="שוב, לוודא" error={error}>
          <input
            name="confirm"
            type="password"
            autoComplete="new-password"
            dir="ltr"
            className={`${inputClass} text-start`}
            placeholder={"•".repeat(MIN_PASSWORD_LENGTH)}
          />
        </Field>

        <Button type="submit" variant="primary" disabled={pending} className="w-full py-2">
          {pending ? "שומר…" : "קבע סיסמה"}
        </Button>
      </form>

      <Link
        href="/forgot-password"
        className="mt-4 block text-center text-sm text-ink-4 hover:text-ink-2 hover:underline"
      >
        לא קיבלת? בקש קוד חדש
      </Link>
    </div>
  );
}
