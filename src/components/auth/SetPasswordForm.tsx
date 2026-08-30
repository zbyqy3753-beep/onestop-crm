"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Field, inputClass } from "@/components/ui/primitives";
import { setPassword, type SetPasswordState } from "@/app/set-password/actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";

export function SetPasswordForm({
  token,
  name,
}: {
  token: string;
  name: string;
}) {
  const [state, formAction, pending] = useActionState<SetPasswordState, FormData>(
    setPassword,
    { status: "idle" },
  );

  if (state.status === "done") {
    return (
      <div className="rounded-xl border border-line bg-surface p-6 text-center">
        <p className="font-semibold text-ink">הסיסמה נקבעה</p>
        <p className="mt-2 text-sm text-ink-3">
          מעכשיו נכנסים איתה. הקישור הזה כבר לא יעבוד.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-block w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
        >
          למסך הכניסה
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      <p className="mb-1 text-sm text-ink-2">
        שלום {name}, בחר סיסמה חדשה לחשבון שלך.
      </p>
      <p className="mb-5 text-xs text-ink-4">
        לפחות {MIN_PASSWORD_LENGTH} תווים.
      </p>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="token" value={token} />

        <Field label="סיסמה חדשה">
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            dir="ltr"
            className={`${inputClass} text-start`}
            placeholder="••••••••••••"
          />
        </Field>

        {/* ⚠️ אישור ולא שדה יחיד: הסיסמה מוקלדת מוסתרת ובטלפון, וטעות
            הקלדה כאן פירושה שהעובד ננעל בחוץ מיד אחרי ששמר — הטוקן
            כבר נוצל ואין לו דרך לנסות שוב בלי לפנות למנהל. */}
        <Field
          label="שוב, לוודא"
          error={state.status === "error" ? state.message : undefined}
        >
          <input
            name="confirm"
            type="password"
            autoComplete="new-password"
            dir="ltr"
            className={`${inputClass} text-start`}
            placeholder="••••••••••••"
          />
        </Field>

        <Button
          type="submit"
          variant="primary"
          disabled={pending}
          className="w-full py-2"
        >
          {pending ? "שומר…" : "קבע סיסמה"}
        </Button>
      </form>
    </div>
  );
}
