"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  PROVIDER_CONFIG,
  PROVIDER_ORDER,
  type LeadCategoryKey,
} from "@/lib/domain/types";
import { submitLandingLead, type LandingState } from "../actions";
import { crmCategory } from "../config";
import { btnPrimary } from "./button";
import { fieldClass, labelClass } from "./field";
import type { Package } from "../catalog/types";

/**
 * טופס ההשארת פרטים של כרטיס חבילה.
 *
 * ⚠️ **Server Action ולא `fetch("/api/leads")`,** בניגוד למקור באתר
 * הציבורי. שם הטופס מדבר עם ה-API של האתר, שמעביר את הליד ל-CRM עם
 * מפתח שיושב בשרת שלו. כאן אנחנו *בתוך* ה-CRM: קריאה ל-`/api/leads`
 * מהדפדפן הייתה מחייבת מפתח API בתוך ה-JS של הדף, כלומר לפרסם אותו.
 *
 * ⚠️ רשימת הספקים היא של ה-CRM (`PROVIDER_CONFIG`) ולא
 * `PROVIDER_CHOICES` של האתר: הערך נשמר בעמודה `currentProvider`
 * שהיא enum, ומחרוזת חופשית הייתה נדחית באימות ומאבדת את השדה בשקט.
 */

const INITIAL: LandingState = { status: "idle" };

function Submit({ label }: { label: string }) {
  // ⚠️ קומפוננטה נפרדת: `useFormStatus` קורא את ה-`<form>` שמעליו, ומחזיר
  // תמיד `false` אם הוא נקרא באותה קומפוננטה שמרנדרת את הטופס.
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${btnPrimary} w-full py-3`}>
      {pending ? "שולח…" : label}
    </button>
  );
}

interface Props {
  /** החבילה שהכרטיס מציג. בטופס הכללי שבתחתית הדף אין כזו. */
  pkg?: Package;
  compact?: boolean;
  /**
   * קטגוריה כשאין חבילה — המחשבון יודע על מה נשאל, גם בלי שנבחרה
   * חבילה מסוימת. עם `pkg` הקטגוריה נגזרת ממנו וזה נדרס.
   */
  category?: LeadCategoryKey;
  /**
   * הקשר שייכתב כהערה הראשונה של הליד (למשל "משלם היום 220 ₪, 3
   * קווים"). כשהוא מסופק, תיבת הטקסט החופשית לא מוצגת: הנציג מקבל
   * את הנתון שהמבקר כבר הזין, ולא מבקשים ממנו לכתוב אותו שוב.
   */
  note?: string;
}

export function LeadForm({ pkg, compact = false, category, note }: Props) {
  const [state, action] = useActionState(submitLandingLead, INITIAL);

  if (state.status === "sent") {
    return (
      <div className="rounded-lp-card bg-lp-save/10 p-4 text-center">
        <p className="font-semibold text-lp-save">קיבלנו! נציג ONE STOP יחזור אליך בהקדם.</p>
        <p className="mt-1 text-sm text-lp-ink-2">
          {pkg ? `לגבי ${pkg.name}` : "לגבי החבילה המשתלמת עבורך"}
        </p>
      </div>
    );
  }

  // מזהה ייחודי לשדות: כל כרטיס מרנדר טופס משלו, ו-`id` כפול היה מקשר
  // את התווית של כרטיס אחד לשדה של אחר.
  const uid = pkg ? pkg.id : "general";

  return (
    <form action={action} className="space-y-3" noValidate>
      {pkg && !compact && (
        <p className="text-sm text-lp-ink-2">
          נציג ONE STOP יחזור אליך לגבי{" "}
          <span className="font-semibold text-lp-ink">{pkg.name}</span>
        </p>
      )}

      {state.status === "error" && (
        <p className="rounded-lg bg-lp-rise-soft p-3 text-sm text-lp-rise" role="alert">
          {state.message}
        </p>
      )}

      <div className={compact ? "space-y-3" : "grid gap-3 sm:grid-cols-2"}>
        <div>
          <label className={labelClass} htmlFor={`lp-name-${uid}`}>
            שם מלא
          </label>
          <input
            id={`lp-name-${uid}`}
            name="name"
            className={fieldClass}
            autoComplete="name"
            maxLength={80}
            required
          />
        </div>
        <div>
          <label className={labelClass} htmlFor={`lp-phone-${uid}`}>
            טלפון
          </label>
          {/*
            בלי `pattern`: האימות האמיתי בשרת מקבל מקפים, רווחים ו-+972,
            ו-`pattern` היה חוסם דווקא את מי שכותב את המספר כרגיל.
          */}
          <input
            id={`lp-phone-${uid}`}
            name="phone"
            type="tel"
            inputMode="numeric"
            className={fieldClass}
            autoComplete="tel"
            placeholder="050-0000000"
            maxLength={20}
            required
          />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor={`lp-prov-${uid}`}>
          הספק הנוכחי שלך <span className="text-lp-ink-3">(עוזר להכין הצעה מדויקת)</span>
        </label>
        <select id={`lp-prov-${uid}`} name="provider" className={fieldClass} defaultValue="">
          <option value="">לא רוצה לציין</option>
          {PROVIDER_ORDER.map((key) => (
            <option key={key} value={key}>
              {PROVIDER_CONFIG[key].label}
            </option>
          ))}
        </select>
      </div>

      {!pkg && !note && (
        <div>
          <label className={labelClass} htmlFor={`lp-msg-${uid}`}>
            משהו שנשמח לדעת מראש <span className="text-lp-ink-3">(לא חובה)</span>
          </label>
          <textarea
            id={`lp-msg-${uid}`}
            name="message"
            rows={3}
            maxLength={500}
            className={fieldClass}
            placeholder="למשל: כמה קווים, מה אני משלם היום, מתי נוח לחזור אליי"
          />
        </div>
      )}
      {note && <input type="hidden" name="message" value={note} />}

      {/*
        הקשר החבילה. `category` נשלח כערך של ה-CRM ונבדק בשרת מול רשימה
        סגורה — ראה `crmCategory`.
      */}
      <input
        type="hidden"
        name="category"
        value={pkg ? crmCategory(pkg) : (category ?? "general")}
      />
      {pkg && (
        <input
          type="hidden"
          name="packageName"
          value={`${pkg.name} · ${pkg.provider.name}`}
        />
      )}

      {/* פיתיון — ראה `.lp-honey` ב-lp.css ואת הבדיקה ב-actions.ts */}
      <div className="lp-honey" aria-hidden="true">
        <label htmlFor={`lp-website-${uid}`}>אתר</label>
        <input id={`lp-website-${uid}`} name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <label className="flex items-start gap-2 text-xs leading-relaxed text-lp-ink-2">
        <input type="checkbox" required className="mt-0.5 h-4 w-4 shrink-0 accent-lp-brand" />
        <span>
          אני מאשר/ת שנציג ONE STOP יצור איתי קשר בטלפון או בוואטסאפ בנוגע לפנייה זו, בהתאם
          למדיניות הפרטיות.
        </span>
      </label>

      <Submit label="שיחזרו אליי" />
    </form>
  );
}
