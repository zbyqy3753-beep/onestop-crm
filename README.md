# ONE STOP CRM

מערכת ניהול לידים, חבילות ועסקאות. עברית, RTL, תמה בהירה/כהה.
Next.js 16 (App Router) · React 19 · Tailwind v4 · TypeScript.

```bash
npm run dev     # http://localhost:3000
npm run build
npm run lint
npx tsc --noEmit
```

## מצב נוכחי

**ברירת המחדל היא זיכרון (`DATA_SOURCE=memory`).** נתוני הזרע נמחקים
בכל אתחול שרת — בכוונה, כדי שאפשר יהיה להריץ את האפליקציה בלי DB
בכלל. **שכבת Postgres מלאה ומחוברת — לא שלד** — ומחכה רק ל-`DATABASE_URL`.

מה שקיים ועובד: מודל דומיין מלא, שכבת repository (זיכרון ו-Postgres
כאחד), שכבת שירותים, Server Actions עם אימות בשרת, ומסכי לידים
וחבילות.

## איך מחברים דאטה בייס

המימוש **כבר כתוב**. החיבור דורש `DATABASE_URL` וכמה פקודות — לא
כתיבת קוד.

```
src/server/
  repositories/
    types.ts       ← החוזה. כל גישה לנתונים עוברת דרכו.
    memory/        ← המימוש הפעיל כברירת מחדל
    prisma/        ← מימוש Postgres מלא (leads/users/packages/deals/settings)
    index.ts       ← בורר לפי DATA_SOURCE, בטעינה עצלה (ראה למטה)
  db/client.ts      ← סינגלטון Prisma Client, מבוסס driver adapter
  services/         ← לוגיקה עסקית (עמלות, רווח, מכפיל)
prisma/
  schema.prisma     ← סכמה מלאה
  seed.ts           ← מזין את אותם נתוני הזרע שמזינים את מימוש הזיכרון
prisma.config.ts     ← Prisma ORM 7: כאן יושב ה-DATABASE_URL, לא בסכמה
```

**חיבור מבוסס `@prisma/adapter-pg`** — לא נעול לספק מסוים. עובד מול
כל Postgres שמקבל connection string רגיל: Neon, Supabase,
Vercel Postgres, RDS, או שרת Postgres רגיל.

השלבים בפועל:

```bash
cp .env.example .env
# ערוך את .env: הדבק DATABASE_URL אמיתי

npm run db:generate     # מייצר את Prisma Client מהסכמה
npm run db:migrate      # יוצר את הטבלאות ב-DB (prisma migrate dev)
npm run db:seed         # מזין נתוני דמו לבדיקה (npx prisma db seed)
```

ואז ב-`.env`:

```
DATA_SOURCE="prisma"
```

זה הצעד היחיד שמשנה התנהגות בפועל. אף `page.tsx` ואף קומפוננטה
לא משתנים.

### למה זה עובד

- **הכל async מהיום הראשון.** גם מימוש הזיכרון מחזיר `Promise`,
  כך שאין קורא שצריך שכתוב.
- **`server-only` על `repositories/index.ts`.** אם קומפוננטת לקוח
  תייבא את שכבת הנתונים בטעות, הבנייה נכשלת במקום שהנתונים יזלגו.
- **הייבוא של `./prisma` דינמי, לא סטטי.** כך שהרצה עם
  `DATA_SOURCE=memory` (ברירת המחדל) לעולם לא מנסה לפתוח חיבור
  Postgres — גם בלי `DATABASE_URL` בסביבה בכלל.
- **הלוגיקה העסקית ב-`services/` ולא ב-repository.** חישוב עמלה
  ורווח חייב להיות זהה בשני המימושים, ולכן הוא לא יושב באף אחד מהם.
- **`Decimal`/`Date` מומרים בגבול אחד** (`repositories/prisma/mappers.ts`)
  ל-`number`/ISO string — כדי שהדומיין לא ידע שמאחוריו יש Prisma.

### הערה: קבצי Prisma Client נשמרים בגיט

`src/generated/prisma/` **לא** ב-`.gitignore`, ובכוונה. ב-Prisma 7,
`prisma generate` דורש `DATABASE_URL` שקיים בסביבה — אפילו כדי לייצר
קוד, לא רק כדי להתחבר בפועל (`prisma.config.ts` קורא לו מיידית עם
כל פקודת CLI). אם הקוד המיוצר לא יישמר בגיט, שכפול טרי של הפרויקט
לא יעבור אפילו `tsc`/`npm run dev` במצב `DATA_SOURCE=memory`, כי
`src/server/repositories/prisma/*` מייבאים ממנו — למרות שהמסלול הזה
לא נטען בפועל במצב זיכרון (הייבוא דינמי, ראה למעלה), טעינת הטיפוסים
של TypeScript עדיין דורשת שהקבצים יהיו קיימים על הדיסק.

אם משנים את `prisma/schema.prisma`, יש להריץ `npm run db:generate`
מחדש ולשמור (commit) את מה שהשתנה תחת `src/generated/prisma/`.

### מה אומת ומה לא

נבדק בלי DB חי: `prisma validate`, `prisma generate`, `tsc --noEmit`,
`eslint`, ובנייה מלאה עם `DATA_SOURCE=prisma` — שנכשלה ב-`ECONNREFUSED`
בדיוק בנקודת השאילתה, כלומר כל השרשרת (טיפוסים, ייבוא, בניית
ה-adapter, בניית השאילתה) תקינה ורק חיבור DB אמיתי חסר.
**לא נבדק מול Postgres חי בפועל** — אין DB זמין בסביבה הזו.
כשיש `DATABASE_URL` אמיתי, `npm run db:migrate && npm run db:seed`
אמורים לעבוד; אם משהו ייכשל שם, זו הנקודה הראשונה לבדוק.

## מה עוד לא נבנה

- **אימות והרשאות.** `CURRENT_USER_ID` הוא קבוע. כל Server Action
  מסומן במקום שבו צריך להיכנס `await auth()`. התפקידים (`Role`)
  כבר מוגדרים ומסננים את הניווט.
- **מסכים:** `/deals`, `/deals-dashboard`, `/my-deals`, `/operator`,
  `/registrations`, `/admin` — מופיעים בניווט כמסומנים "בקרוב".
- **ייבוא CSV** — ה-Server Action (`importLeadsAction`) קיים ומאומת,
  אבל אין עדיין ממשק שמפעיל אותו.
- **בדיקות.** אין חבילת בדיקות.

## עיצוב

טוקני צבע סמנטיים ב-`src/app/globals.css`, מוגדרים פעמיים —
בהיר וכהה — וממופים דרך `@theme inline`. אין צבעי hex בקומפוננטות.
החלפת תמה = החלפת `data-theme` על `<html>`.

התמה נטענת בסקריפט inline ב-`<head>` לפני הציור הראשון, כדי שלא
יהיה הבהוב. היא נקראת דרך `useSyncExternalStore` ולא דרך `useState`,
כי מקור האמת הוא ה-DOM.

זמנים יחסיים ("לפני 3 שע׳") מגיעים מ-`useNow()` ב-`src/lib/clock.ts`,
שמחזיר `null` עד שהלקוח נרשם — אחרת השרת והלקוח היו מרנדרים
זמנים שונים.
