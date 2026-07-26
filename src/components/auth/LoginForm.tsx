"use client";

import { useActionState } from "react";
import { Button, Field, inputClass } from "@/components/ui/primitives";
import { signIn, startTestSession } from "@/app/login/actions";

export function LoginForm() {
  const [error, formAction, pending] = useActionState(signIn, null);

  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      <form action={formAction} className="space-y-4">
        <Field label="אימייל">
          <input
            name="email"
            type="email"
            autoComplete="username"
            dir="ltr"
            className={`${inputClass} text-start`}
            placeholder="name@onestop.co.il"
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

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[11px] text-ink-4">או</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      {/* הנתיב היחיד שבאמת מכניס כרגע */}
      <form action={startTestSession}>
        <Button type="submit" variant="secondary" className="w-full py-2">
          כניסת בדיקה
        </Button>
      </form>
    </div>
  );
}
