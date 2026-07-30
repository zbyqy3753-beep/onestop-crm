"use client";

import { useActionState } from "react";
import { Button, Field, inputClass } from "@/components/ui/primitives";
import { signIn } from "@/app/login/actions";

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
    </div>
  );
}
