"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Field, inputClass } from "@/components/ui/primitives";
import { signIn } from "@/app/login/actions";
import { NEXT_PARAM } from "@/lib/returnTo";

export function LoginForm({ next }: { next: string }) {
  const [error, formAction, pending] = useActionState(signIn, null);

  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      <form action={formAction} className="space-y-4">
        {/* היעד עבר כבר דרך `safeReturnTo` בשרת, ונבדק שם שוב אחרי
            השליחה — שדה נסתר הוא קלט של המשתמש לכל דבר */}
        <input type="hidden" name={NEXT_PARAM} value={next} />

        {/*
          ⚠️ `type="text"` ולא `type="email"`. אימות המייל של הדפדפן
          פוסל מחרוזת בלי `@` עוד לפני השליחה — כלומר `type="email"`
          היה חוסם כניסה בשם משתמש בלבד, וללא הודעה מהמערכת שלנו.
        */}
        <Field label="שם משתמש או אימייל">
          <input
            name="email"
            type="text"
            autoComplete="username"
            dir="ltr"
            className={`${inputClass} text-start`}
            placeholder="idan"
          />
        </Field>

        <Field label="סיסמה" error={error ?? undefined}>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            dir="ltr"
            className={`${inputClass} text-start`}
            placeholder="••••••••"
          />
        </Field>

        <Button
          type="submit"
          variant="primary"
          disabled={pending}
          className="w-full py-2"
        >
          {pending ? "בודק…" : "כניסה"}
        </Button>
      </form>

      {/* ⚠️ הקישור היחיד שמוציא עובד נעול מהמבוי הסתום. בלעדיו כל
          סיסמה שנשכחה היא פנייה למנהל, וזה בדיוק מה שגרם לכך
          שהסיסמאות בארגון היו קלות מדי מלכתחילה. */}
      <Link
        href="/forgot-password"
        className="mt-4 block text-center text-sm text-ink-4 hover:text-ink-2 hover:underline"
      >
        שכחת סיסמה?
      </Link>
    </div>
  );
}
