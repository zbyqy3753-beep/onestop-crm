"use client";

import { useActionState, useState } from "react";
import type { FeedbackKind } from "@/lib/domain/feedback";
import {
  FEEDBACK_KIND_CONFIG,
  FEEDBACK_KIND_ORDER,
  GENERAL_SCREEN,
} from "@/lib/domain/feedback";
import { Button, Field, inputClass } from "@/components/ui/primitives";
import { NAV } from "@/components/shell/nav";
import { submitFeedback } from "@/app/(app)/feedback/actions";

/** אפשרויות המסך נבנות מ-`NAV` כדי שלא תהיה רשימה כפולה לתחזק. */
const SCREENS = [
  { href: GENERAL_SCREEN, label: "כללי — לא מסך מסוים" },
  ...NAV.flatMap((g) => g.items.map((i) => ({ href: i.href, label: i.label }))),
];

const RATINGS = [1, 2, 3, 4, 5];

export function FeedbackForm() {
  const [state, formAction, pending] = useActionState(submitFeedback, null);
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [rating, setRating] = useState(3);

  return (
    <section className="h-fit rounded-card border border-line bg-surface p-5">
      <h2 className="mb-4 font-display text-base font-semibold">משוב חדש</h2>

      {/* key מאפס את השדות אחרי שליחה מוצלחת */}
      <form
        key={state?.ok ? "sent" : "draft"}
        action={formAction}
        className="space-y-4"
      >
        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink-2">
            סוג
          </span>
          <div className="flex gap-1.5">
            {FEEDBACK_KIND_ORDER.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                // `min-h-11` — היו 34px. אלה שלושת הכפתורים הראשונים
                // בטופס, וטופס משוב שקשה למלא בטלפון פשוט לא ימולא
                className={`min-h-11 flex-1 rounded-md border px-2 py-1.5 text-[13px] font-medium transition-colors active:bg-surface-2 lg:min-h-0 ${
                  kind === k
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-line text-ink-3 hover:bg-surface-2 hover:text-ink-1"
                }`}
              >
                {FEEDBACK_KIND_CONFIG[k].label}
              </button>
            ))}
          </div>
          <input type="hidden" name="kind" value={kind} />
        </div>

        <Field label="מסך">
          <select name="screen" className={inputClass} defaultValue={GENERAL_SCREEN}>
            {SCREENS.map((s) => (
              <option key={s.href} value={s.href}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink-2">
            עד כמה זה חשוב
          </span>
          <div className="flex gap-1.5">
            {RATINGS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-pressed={rating === n}
                aria-label={`דירוג ${n} מתוך 5`}
                // `size-11` בטלפון — חמישה כפתורים של 36px זה מתחת לסף
                // המגע, ודירוג הוא בדיוק הדבר שנוגעים בו פעם אחת ובזריזות
                className={`nums size-11 rounded-md border text-sm font-semibold transition-colors active:scale-95 lg:size-9 ${
                  rating >= n
                    ? "border-brand bg-brand text-on-brand"
                    : "border-line text-ink-4 hover:bg-surface-2"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <input type="hidden" name="rating" value={rating} />
        </div>

        <Field label="תיאור" error={state?.error}>
          <textarea
            name="body"
            rows={5}
            className={`${inputClass} resize-y`}
            placeholder="מה קרה, מה ציפית שיקרה, ואיך להגיע לזה שוב"
          />
        </Field>

        {/*
          ⚠️ אין כאן שדה "השם שלך", ואין להחזיר אותו. השם נלקח מהסשן
          בצד השרת (`submitFeedback`), כי שדה זהות שהלקוח שולח אינו
          זהות — אפשר היה לחתום בשם עובד אחר. שדה שהשרת מתעלם מערכו
          גרוע משדה שאינו קיים.
        */}

        <Button
          type="submit"
          variant="primary"
          disabled={pending}
          className="w-full py-2"
        >
          {pending ? "שולח…" : "שליחת משוב"}
        </Button>

        {state?.ok && (
          <p className="rounded-md bg-good-soft px-3 py-2 text-center text-[13px] font-medium text-good">
            תודה — המשוב נקלט.
          </p>
        )}
      </form>
    </section>
  );
}
