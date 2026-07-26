# אפיון: מסך התחברות (שלד) + מערכת משוב בודקים ב-Firebase

תאריך: 2026-07-20
פרויקט: `onestop-crm`

---

## המטרה

שתי תוספות נפרדות שנבנות יחד:

1. **שלד התחברות** — מסך `/login` שנראה וחווה כמו מערכת התחברות אמיתית,
   אבל **לא מחובר לשום מקור אימות**. הכניסה בפועל נעשית בכפתור "כניסת בדיקה".
   המטרה: להעמיד את המבנה עכשיו כדי שחיבור אמיתי בעתיד יהיה החלפה של
   פונקציה אחת, לא שכתוב מסך.

2. **מערכת משוב** — מסך `/feedback` שבו **בודקים מדווחים על המערכת עצמה**
   (באגים, בקשות שיפור, רעיונות), כדי שהמפתח יידע מה לתקן. זהו **המקום
   היחיד בפרויקט שנוגע ב-Firebase**.

### מה מפורשות מחוץ לתחום

נתוני ה-CRM (לידים, עסקאות, חבילות, משתמשים, רישומים) **נשארים על
`SEED_*` בזיכרון**. אין חיבור DB למערכת. `DATA_SOURCE` נשאר `memory`.
Firebase נוגע במשוב בלבד ולא בשום ישות דומיין קיימת.

---

## חלק 1 — גישה לפי קישור סודי

### החלטה מפורשת: הסתרה, לא אבטחה

הגישה נשלטת ע"י מפתח סודי ב-URL. **זו אינה אבטחה.** מי שקיבל את
הקישור יכול להעביר אותו הלאה; העוגייה אינה חתומה וניתנת לזיוף.
המשתמש קיבל את ההסבר הזה ובחר בכל זאת במודל הזה, כי מדובר בגרסת
בדיקה לבודקים מוכרים.

**נובע מכך:** אין להעלות לסביבה הזו נתוני לקוחות אמיתיים.

### זרימת הגישה

1. הבודק מקבל קישור: `https://<host>/?k=<ACCESS_KEY>`.
2. `middleware.ts` מזהה `?k=` תקין → מגדיר עוגיית `os_session` →
   מפנה לאותו נתיב **בלי** ה-query (כדי שהמפתח לא יישאר בהיסטוריה,
   ב-referrer או בצילומי מסך).
3. מכאן העוגייה מספיקה; הקישור נדרש שוב רק אחרי ניקוי עוגיות.
4. בקשה בלי עוגייה ובלי מפתח תקין → **404**, לא הפניה. 404 לא מסגיר
   שיש כאן מערכת בכלל.

`ACCESS_KEY` מגיע מ-`.env`, לא מהקוד.

### `robots.ts` + `noindex`

`src/app/robots.ts` שחוסם הכל, וכותרת `X-Robots-Tag: noindex` ב-
`next.config.ts` — בדיוק כמו הדפוס הקיים ב-`datalink-crm`.

### מסך `/login`

חי **מחוץ** ל-route group `(app)/` (כמו `/form/[token]`), כי הוא חייב
לרנדר בלי סרגל צד. נתיב: `src/app/login/page.tsx`.

עיצוב: RTL, עברית, שפת העיצוב הקיימת — אסימוני `@theme` מ-`globals.css`
בלבד (`bg-surface-2`, `text-ink-2`, `border-line`, `bg-brand/8`). ללא hex גולמי.

תוכן המסך:

- לוגו/wordmark ONE STOP.
- שדה אימייל + שדה סיסמה — מרונדרים ופעילים ויזואלית, אבל שליחתם
  מחזירה תמיד "האימות עדיין לא חובר" (ראה `verifyCredentials` למטה).
- כפתור ראשי **"כניסת בדיקה"** — הנתיב היחיד שבאמת מכניס למערכת.
- הערת עזר קטנה מתחת: "מצב פיתוח — האימות עדיין לא מחובר".

### מודול הסשן

`src/server/auth/session.ts` — נקודת ההחלפה היחידה:

```
verifyCredentials(email, password): Promise<User | null>
```

המימוש הנוכחי מחזיר `null` תמיד, עם הערת קוד מפורשת שמסבירה שזו
נקודת החיבור העתידית. כשירצו אימות אמיתי — משנים את הפונקציה הזו בלבד.

בנוסף:

- `startTestSession()` — Server Action. מגדירה עוגייה `os_session`
  (`httpOnly`, `sameSite: "lax"`, `path: "/"`) עם מזהה משתמש הבדיקה
  הקיים (`CURRENT_USER_ID`), ומפנה ל-`/`.
- `endSession()` — מוחקת את העוגייה ומפנה ל-`/login`.
- `getSessionUser()` — קוראת את העוגייה ומחזירה את המשתמש מ-`SEED_USERS`,
  או `null`.

### `src/proxy.ts`

**לא `middleware.ts`** — ב-Next.js 16 המוסכמת הזו הוצאה משימוש ושמה
שונה ל-`proxy`. הקובץ יושב ב-`src/` (לצד `app/`), לא בשורש הפרויקט;
בשורש הוא נטען בשקט ולא רץ כלל.

לוגיקה לפי הסדר:

1. נתיב ציבורי (`/form/*`, `/_next/*`, `/favicon.ico`, סטטי) → מעבר חופשי.
2. יש עוגיית `os_session` → מעבר חופשי.
3. יש `?k=` שתואם ל-`ACCESS_KEY` → הגדרת עוגייה + הפניה לנתיב הנקי.
4. אחרת → **404**.

ההשוואה של המפתח נעשית בזמן קבוע (`timingSafeEqual`) — זול, ומונע
את מחלקת ההתקפות הזולה היחידה שרלוונטית כאן.

> הערה מפורשת בקוד: זו שכבת הסתרה, לא אבטחה. ראה "החלטה מפורשת" למעלה.

### התנתקות

פריט "יציאה" בתחתית סרגל הצד ב-`AppShell.tsx`, לצד פרטי המשתמש הקיימים,
קורא ל-`endSession()`.

---

## חלק 2 — מערכת המשוב

### מודל הנתונים

`src/lib/domain/feedback.ts` (מודול חדש; **לא** נכנס ל-`types.ts` של
הדומיין העסקי — משוב הוא מטא-דאטה על המוצר, לא ישות עסקית):

```ts
type FeedbackKind = "bug" | "improvement" | "idea";

interface Feedback {
  id: string;
  kind: FeedbackKind;
  screen: string;      // נתיב מתוך NAV, או "general"
  rating: number;      // 1..5
  body: string;
  reporter: string;    // שם חופשי, לא מקושר ל-User
  createdAt: string;   // ISO
}
```

בתוספת `FEEDBACK_KIND_CONFIG` (תווית עברית + צבע) בדיוק בתבנית
`STATUS_CONFIG` הקיימת — מקור אמת יחיד לרינדור.

### שכבת האחסון

`src/server/feedback/store.ts` — ממשק אחד, שני מימושים, נבחרים מ-`.env`.
זהו **מראה מדויקת של דפוס `DATA_SOURCE`** ב-`src/server/repositories/index.ts`,
כולל `import "server-only"` ו-import דינמי:

```
FeedbackStore { list(): Promise<Feedback[]>; create(input): Promise<Feedback> }
```

- **`memory`** (ברירת מחדל) — מערך בתהליך. נעלם בהפעלה מחדש. מאפשר
  לפתח ולבדוק את כל המסך בלי Firebase בכלל.
- **`firestore`** — `firebase-admin`, collection `feedback`, ממוין
  `createdAt desc`. הייבוא דינמי כדי ש-`memory` לא ינסה לאתחל את ה-SDK.

הבחירה לפי `FEEDBACK_STORE`. ערך לא מוכר → זריקת שגיאה מפורשת, כמו
ב-`resolve()` הקיים.

### קרדנציאלס

Firebase Admin רץ **בשרת בלבד**. שלושה משתני סביבה, נוספים ל-`.env.example`
עם הסבר בעברית:

```
ACCESS_KEY=""                # המפתח הסודי בקישור לבודקים
FEEDBACK_STORE="memory"      # memory | firestore
FIREBASE_PROJECT_ID=""
FIREBASE_CLIENT_EMAIL=""
FIREBASE_PRIVATE_KEY=""      # שורה אחת, \n כתווים ממש
```

אין שימוש ב-Firebase Web SDK ואין מפתחות בצד לקוח.

### המסך `/feedback`

`src/app/(app)/feedback/page.tsx` — Server Component, קורא
`feedbackStore.list()` ומעביר לקליינט.

קומפוננטות ב-`src/components/feedback/`:

- `FeedbackClient.tsx` — מחזיק מצב טופס + סינון לפי `kind`.
- `FeedbackForm.tsx` — סוג (שלושה כפתורי toggle), מסך (select שנבנה
  דינמית מ-`NAV`, plus "כללי"), דירוג 1-5, תיאור (textarea), שם הבודק.
- `FeedbackList.tsx` — כל המשובים שהתקבלו, החדש ראשון, `Badge` לפי
  `FEEDBACK_KIND_CONFIG`.

`src/app/(app)/feedback/actions.ts` — `"use server"`. מאמת שדות
(`body` לא ריק, `rating` בטווח 1-5, `kind` חוקי), כותב דרך `feedbackStore`,
ומריץ `revalidatePath("/feedback")`.

חותמות זמן יחסיות מרונדרות דרך דפוס ה-`now` הקיים ב-client כדי למנוע
אי-התאמות הידרציה.

### ניווט

`src/components/shell/nav.ts` — פריט חדש בסוף קבוצת "עבודה יומית":

```
{ href: "/feedback", label: "משוב", hint: "דיווח באגים ובקשות שיפור", icon: "feedback" }
```

ללא `roles` — גלוי לכולם. `IconName` מקבל `"feedback"`, והאייקון עצמו
נוסף למפת האייקונים ב-`AppShell.tsx`. `PAGE_TITLES` מקבל `/feedback`: "משוב",
ו-`/login` לא נכנס (הוא מחוץ ל-shell).

---

## תלויות חדשות

`firebase-admin` (dependency). זו התוספת היחידה.

---

## אימות

- `npx tsc --noEmit`, `npx eslint .`, `npm run build` — נקיים.
- `FEEDBACK_STORE=memory` (ברירת מחדל): שליחת משוב → הופעה מיידית ברשימה.
- `middleware`: גישה ל-`/leads` בלי עוגייה → הפניה ל-`/login`;
  "כניסת בדיקה" → הגעה ל-`/`; "יציאה" → חזרה ל-`/login`.
- `/form/<token>` נגיש בלי התחברות ובלי סרגל צד.
- בדיקה חזותית בשתי התמות (בהיר/כהה), RTL תקין.
- `FEEDBACK_STORE=firestore` בלי קרדנציאלס → שגיאה ברורה, לא קריסה אילמת.
