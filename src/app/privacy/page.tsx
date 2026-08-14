import type { Metadata } from "next";

/**
 * מדיניות הפרטיות — עמוד ציבורי.
 *
 * ⚠️ קיים כדרישה של Google Play: אי אפשר לשחרר אפליקציה לשום ערוץ,
 * כולל Internal Testing, בלי כתובת מדיניות פרטיות **שנגישה בלי
 * התחברות**. לכן הוא יושב מחוץ ל-route group `(app)` (אין לו מעטפת
 * CRM) ונתיבו `/privacy` נוסף ל-`PUBLIC_PREFIXES` ב-`proxy.ts`.
 *
 * ⚠️ אל תוסיף לו `noindex`. עמוד שמנועי חיפוש לא רואים עדיין נגיש
 * לבודקי גוגל, אבל הכוונה כאן הפוכה מזו של שאר המערכת: זה המסמך
 * היחיד שאמור להיות גלוי. שאר האתר מוסתר ע"י `robots.ts`.
 *
 * המסמך מתאר את המצב בפועל: מערכת פנימית לעובדי ONE STOP בלבד, שאינה
 * פתוחה להרשמה ואינה אוספת נתונים ממשתמשי קצה חיצוניים.
 */
export const metadata: Metadata = {
  title: "מדיניות פרטיות | ONE STOP CRM",
};

const UPDATED = "14 באוגוסט 2026";

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl bg-bg px-5 py-10 sm:px-8">
      <p className="font-display text-lg font-bold tracking-tight text-ink-1">
        ONE STOP
      </p>
      <h1 className="mt-2 font-display text-2xl font-bold text-ink-1">
        מדיניות פרטיות — אפליקציית ONE STOP CRM
      </h1>
      <p className="mt-1 text-sm text-ink-3">עודכן לאחרונה: {UPDATED}</p>

      <div className="mt-8 space-y-7 text-sm leading-relaxed text-ink-2">
        <Section title="למי האפליקציה מיועדת">
          ONE STOP CRM היא מערכת פנימית לניהול לידים, חבילות ועסקאות,
          המיועדת <strong>לעובדי ONE STOP בלבד</strong>. אין אפשרות הרשמה
          עצמית: חשבונות נוצרים על ידי הנהלת החברה. האפליקציה אינה מיועדת
          לשימוש הציבור הרחב ואינה מיועדת לילדים מתחת לגיל 13.
        </Section>

        <Section title="איזה מידע נאסף">
          <p>האפליקציה היא מעטפת שמציגה את המערכת מהשרת שלנו. נאסף:</p>
          <ul className="mt-2 list-disc space-y-1 ps-5">
            <li>
              <strong>פרטי החשבון של העובד</strong> — כתובת דוא״ל ושם, לצורך
              הזדהות והרשאות.
            </li>
            <li>
              <strong>נתוני עבודה שהעובד מזין</strong> — פרטי לידים, הערות,
              סטטוסים ועסקאות.
            </li>
            <li>
              <strong>נתוני התחברות טכניים</strong> — עוגיית סשן ומועד הפעילות
              האחרונה, כדי לשמור על החיבור ולנתק חשבונות נטושים.
            </li>
          </ul>
          <p className="mt-2">
            האפליקציה <strong>אינה</strong> אוספת מיקום, אנשי קשר, תמונות,
            מיקרופון, מצלמה או מזהי פרסום, ואינה מציגה פרסומות.
          </p>
        </Section>

        <Section title="מה נעשה במידע">
          המידע משמש אך ורק להפעלת המערכת עבור ONE STOP: הצגת תור העבודה
          לעובד, ניהול העסקאות, וחישוב עמלות. <strong>איננו מוכרים מידע</strong>{" "}
          ואיננו מעבירים אותו לצדדים שלישיים למטרות שיווק.
        </Section>

        <Section title="היכן המידע נשמר">
          הנתונים נשמרים במסד נתונים מנוהל (Supabase / PostgreSQL) בשרתים
          באיחוד האירופי, ומועברים תמיד בחיבור מוצפן (HTTPS).
        </Section>

        <Section title="כמה זמן המידע נשמר">
          נתוני לידים ועסקאות נשמרים כל עוד הם דרושים לפעילות העסקית ולדרישות
          החוק. חשבון עובד שסיים את עבודתו מושבת, והגישה שלו נחסמת מיידית.
        </Section>

        <Section title="הרשאות שהאפליקציה מבקשת">
          האפליקציה מבקשת הרשאת <strong>גישה לאינטרנט</strong> בלבד, הדרושה
          לטעינת המערכת מהשרת.
        </Section>

        <Section title="הזכויות שלך">
          עובד רשאי לבקש לעיין במידע האישי שנשמר עליו, לתקן אותו, או לבקש את
          מחיקתו בכפוף לחובות שמירת רשומות. לפנייה בנושא — צור קשר בכתובת
          שלהלן.
        </Section>

        <Section title="שינויים במדיניות">
          נעדכן את המסמך הזה אם השימוש במידע ישתנה. תאריך העדכון האחרון מופיע
          בראש העמוד.
        </Section>

        <Section title="יצירת קשר">
          לשאלות בנושא פרטיות ניתן לפנות להנהלת ONE STOP בדוא״ל:{" "}
          <a
            href="mailto:890408orhan@gmail.com"
            className="ltr-num text-brand underline underline-offset-2"
          >
            890408orhan@gmail.com
          </a>
        </Section>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-1.5 font-display text-base font-bold text-ink-1">
        {title}
      </h2>
      <div>{children}</div>
    </section>
  );
}
