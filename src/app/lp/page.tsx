import type { Metadata } from "next";
import { LandingForm } from "./LandingForm";
import { LANDING_CATEGORIES } from "./config";
import "./lp.css";

/**
 * דף הנחיתה הציבורי.
 *
 * ⚠️ יושב **מחוץ** לקבוצת `(app)` בכוונה: אין כאן `AppShell`, סרגל
 * תחתון או בדיקת סשן — זה עמוד ללקוחות, לא מסך של המערכת. הנתיב
 * פתוח בשער הגישה (`src/proxy.ts`).
 *
 * ⚠️ **לא מאונדקס.** הכותרת `X-Robots-Tag: noindex` מ-`next.config.ts`
 * חלה על כל הנתיבים, וכאן זה מכוון: הדף מופץ בקישור ישיר בלבד.
 * `robots` שלמטה חוזר על אותה הצהרה גם ברמת ה-meta, כדי שהיא לא
 * תלויה בכותרת בלבד.
 *
 * הליד שנוצר מכאן משויך לעובד שב-`LANDING_ASSIGNEE_EMAIL` ונושא
 * "מקור" קבוע — ראה `actions.ts`.
 */

export const metadata: Metadata = {
  title: "ONE STOP | השוואת חבילות סלולר, סיבים, טלוויזיה וחשמל",
  description:
    "משאירים פרטים ומקבלים השוואה אישית לכל החשבונות של הבית — בלי עלות ובלי התחייבות.",
  robots: { index: false, follow: false },
};

export default function LandingPage() {
  return (
    <main className="lp-root">
      <div className="lp-frame">
        <div className="lp-brand">ONE STOP</div>
        <div className="lp-rule">━━━ ✦ ━━━</div>

        <h1 className="lp-title">
          כל החשבונות של הבית
          <br />
          <em>במקום אחד</em>
        </h1>

        <p className="lp-lede">
          אנחנו בודקים מולכם מה אתם משלמים היום — ומוצאים איפה אפשר לשלם פחות.
          <br />
          השוואה אישית, בלי עלות ובלי התחייבות.
        </p>

        <div className="lp-strip">
          {LANDING_CATEGORIES.filter((c) => c.key !== "general").map((c) => (
            <div key={c.key}>
              <span aria-hidden="true">{c.icon}</span>
              {c.label === "אינטרנט וסיבים" ? "סיבים" : c.label}
            </div>
          ))}
        </div>

        <LandingForm />

        <div className="lp-trust">
          <span>✓ ללא עלות</span>
          <span>✓ ללא התחייבות</span>
          <span>✓ מענה מהיר</span>
        </div>

        <p className="lp-legal">
          בשליחת הטופס אתם מאשרים שנציג ONE STOP יחזור אליכם בנוגע לפנייה.
          <br />
          <a href="/privacy">מדיניות הפרטיות</a>
        </p>
      </div>
    </main>
  );
}
