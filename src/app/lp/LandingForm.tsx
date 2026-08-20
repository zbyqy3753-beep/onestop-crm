"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { PROVIDER_CONFIG, PROVIDER_ORDER } from "@/lib/domain/types";
import { submitLandingLead, type LandingState } from "./actions";
import { LANDING_CATEGORIES } from "./config";

/**
 * הטופס של דף הנחיתה.
 *
 * הבחירה בקטגוריה היא שבבים ולא `<select>`: בנייד זו לחיצה אחת במקום
 * שלוש, וזה השדה שהכי הרבה נוטשים בו. הערך עצמו נוסע ב-`<input
 * type="hidden">` כדי שהוא יגיע ל-FormData כמו כל שדה אחר.
 */

const INITIAL: LandingState = { status: "idle" };

function Submit() {
  // ⚠️ קומפוננטה נפרדת בכוונה — `useFormStatus` קורא את מצב ה-`<form>`
  // שמעליו, ומחזיר תמיד `false` אם הוא נקרא באותה קומפוננטה שמרנדרת
  // את הטופס עצמו.
  const { pending } = useFormStatus();
  return (
    <button className="lp-submit" type="submit" disabled={pending}>
      {pending ? "שולח…" : "שלחו לי הצעה"}
    </button>
  );
}

export function LandingForm() {
  const [state, action] = useActionState(submitLandingLead, INITIAL);
  const [category, setCategory] = useState<string>("");

  if (state.status === "sent") {
    return (
      <div className="lp-card lp-thanks">
        <div className="lp-mark">✦</div>
        <h2>קיבלנו את הפנייה</h2>
        <p>
          תודה! נציג ONE STOP יחזור אליכם בהקדם
          <br />
          עם ההצעה המשתלמת ביותר עבורכם.
        </p>
      </div>
    );
  }

  return (
    <form className="lp-card" action={action}>
      {state.status === "error" && (
        <p className="lp-error" role="alert">
          {state.message}
        </p>
      )}

      <div className="lp-field">
        <label className="lp-label" htmlFor="lp-name">
          שם מלא
        </label>
        <input
          className="lp-input"
          id="lp-name"
          name="name"
          type="text"
          autoComplete="name"
          maxLength={80}
          required
          placeholder="ישראל ישראלי"
        />
      </div>

      <div className="lp-field">
        <label className="lp-label" htmlFor="lp-phone">
          טלפון
        </label>
        {/*
          `type="tel"` ו-`inputMode="numeric"` פותחים מקלדת ספרות בנייד.
          אין כאן `pattern` — האימות האמיתי הוא בשרת, ו-`pattern` היה
          חוסם מספרים שנכתבו עם מקפים או רווחים, שהשרת מקבל בשמחה.
        */}
        <input
          className="lp-input"
          id="lp-phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          maxLength={20}
          required
          placeholder="050-0000000"
        />
      </div>

      <div className="lp-field">
        <span className="lp-label">מה מעניין אותך?</span>
        <div className="lp-chips">
          {LANDING_CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              className="lp-chip"
              aria-pressed={category === c.key}
              onClick={() => setCategory(c.key)}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>
        <input type="hidden" name="category" value={category} />
      </div>

      <div className="lp-field">
        <label className="lp-label" htmlFor="lp-provider">
          הספק שלי היום <small>· לא חובה</small>
        </label>
        <select className="lp-select" id="lp-provider" name="provider" defaultValue="">
          <option value="">לא יודע / אחר</option>
          {PROVIDER_ORDER.map((key) => (
            <option key={key} value={key}>
              {PROVIDER_CONFIG[key].label}
            </option>
          ))}
        </select>
      </div>

      <div className="lp-field">
        <label className="lp-label" htmlFor="lp-message">
          משהו שנשמח לדעת מראש <small>· לא חובה</small>
        </label>
        <textarea
          className="lp-textarea"
          id="lp-message"
          name="message"
          maxLength={500}
          placeholder="למשל: כמה קווים, מה אני משלם היום, מתי נוח לחזור אליי"
        />
      </div>

      {/* פיתיון — ראה `.lp-honey` ב-lp.css ואת הבדיקה ב-actions.ts */}
      <div className="lp-honey" aria-hidden="true">
        <label htmlFor="lp-website">אתר</label>
        <input id="lp-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <Submit />
    </form>
  );
}
