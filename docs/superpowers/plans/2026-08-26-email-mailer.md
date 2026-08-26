# תוכנית מימוש — כלי דיוור במייל

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** מסך `/mailer` ב-CRM ששולח דיוור אישי לכמה מאות נמענים מקובץ Excel/CSV, דרך חשבון Gmail, עם תור, תקרה יומית והסרה מרשימה.

**Architecture:** תור במסד בדפוס `WhatsAppMessage` — שורה עם snapshot מרונדר, תביעה מותנית שבטוחה להרצה כפולה, חלון שליחה ותקרה יומית מתוך שורת הגדרות. הניקוז נתלה על תקתוק ה-`pg_cron` הקיים ולא מקבל מתזמן משלו. השליחה בפועל מאחורי ממשק אחד (`sendMail`) כדי שהחלפת ספק תהיה קובץ אחד.

**Tech Stack:** Next.js 16.2.10 (App Router), React 19, Prisma 7 + Postgres (Supabase), Tailwind v4, TypeScript, `nodemailer` (תלות ריצה חדשה יחידה), `node:test` דרך `tsx`.

**Spec:** [`docs/superpowers/specs/2026-08-26-email-mailer-design.md`](../specs/2026-08-26-email-mailer-design.md)

## Global Constraints

- **עברית ו-RTL בכל טקסט שמשתמש רואה.** תוויות, שגיאות, ומיילים.
- **קרא את המדריך ב-`node_modules/next/dist/docs/` לפני קוד Next.js.** זו גרסה 16.2.10 והיא נבדלת מנתוני האימון (`AGENTS.md`).
- **תלות ריצה חדשה יחידה מותרת: `nodemailer`.** שום ספרייה נוספת — לא ל-CSV, לא ל-XLSX (יש `src/lib/csv.ts` ו-`src/lib/xlsx.ts`), ולא ל-HTML.
- **הרשאות רק ב-`ROUTE_ROLES`** שב-`src/lib/domain/permissions.ts`. אין שדה `roles` ב-`nav.ts` ואין קבוע `ALLOWED` מקומי ב-`page.tsx` — הכפילות הזו כבר גרמה לדליפת הרשאות במערכת הזו.
- **חלון שליחה 08:00–21:00 שעון ישראל, תקרה יומית 400, 20 מיילים לתקתוק** — ברירות מחדל ב-`MAILER_DEFAULTS`, ניתנות לשינוי מהמסד.
- **`dedupeKey` בצורה `campaign:<campaignId>:<מייל מנורמל>`** — בדיוק כך, כי הוא מה שמונע כפילות.
- **הגוף והנושא נשמרים כ-snapshot מרונדר** ולא נגזרים בזמן השליחה.
- **משתני סביבה חדשים:** `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `MAILER_SECRET`. כולם נכנסים ל-`.env.example` בלי ערכים אמיתיים.
- **בדיקות:** `npm test`. אחרי משימה 0 הוא רץ דרך `tsx`, ולכן ייבוא `@/...` מותר בכל מודול.

---

### Task 0: לתקן את מריץ הבדיקות

`npm test` היום מריץ `node --test`, שאינו יודע לפתור את הכינוי `@/`. שתי חבילות בדיקה קיימות נכשלות בגללו (`importColumns`, `xlsxWrite`) — 23 עוברות מתוך 25. תחת `tsx` עוברות 45 מתוך 45. בלי התיקון הזה כל בדיקה חדשה תיאלץ להימנע מ-`@/`, בניגוד לכל שאר הפרויקט.

**Files:**
- Modify: `package.json` (שדה `scripts.test`)
- Modify: `tools/importColumns.test.mjs` (הערת ההרצה בראש הקובץ, שורות 5–7)

**Interfaces:**
- Consumes: אין
- Produces: `npm test` ירוק, ומכאן והלאה כל משימה מסתמכת עליו

- [ ] **Step 1: להריץ את הבדיקות ולראות את הכישלון הקיים**

```bash
npm test
```

Expected: `fail 2` — `tools\importColumns.test.mjs` ו-`tools\xlsxWrite.test.mjs`

- [ ] **Step 2: להחליף את המריץ**

ב-`package.json`, בשדה `scripts`:

```json
    "test": "tsx --test \"tools/*.test.mjs\"",
```

(`tsx` כבר ב-`devDependencies` — אין להוסיף תלות.)

- [ ] **Step 3: לעדכן את ההערה שהפכה ללא נכונה**

ב-`tools/importColumns.test.mjs`, להחליף את שלוש שורות ההערה בראש הקובץ:

```js
// הרצה: npm test
// (המריץ הוא tsx ולא node --test: המודולים מייבאים דרך "@/...",
// ופתרון הכינוי מגיע מ-tsconfig.)
```

- [ ] **Step 4: להריץ שוב**

```bash
npm test
```

Expected: `pass 45`, `fail 0`

- [ ] **Step 5: קומיט**

```bash
git add package.json tools/importColumns.test.mjs
git commit -m "מריץ הבדיקות עובר ל-tsx, ושתי החבילות שנשברו על הכינוי חוזרות"
```

---

### Task 1: הסכימה במסד

**Files:**
- Modify: `prisma/schema.prisma` (הוספה בסוף)
- Modify: `.env.example`

**Interfaces:**
- Consumes: אין
- Produces: המודלים `EmailCampaign`, `EmailMessage`, `EmailOptOut`, `MailerSettings` ו-enum `EmailMessageStatus`, `EmailCampaignStatus` — כל שאר המשימות נשענות על השמות האלה

- [ ] **Step 1: להוסיף את המודלים לסכימה**

בסוף `prisma/schema.prisma`:

```prisma
/**
 * ── דיוור במייל ──────────────────────────────────────────────────────
 */

enum EmailCampaignStatus {
  draft
  sending
  paused
  done
}

enum EmailMessageStatus {
  queued
  sending
  sent
  failed
  cancelled
}

/// דיוור אחד — הרשימה, הטקסט, ומי שלח.
///
/// הנמענים מגיעים מקובץ חיצוני ולא מהלידים, ולכן אין כאן שום קשר
/// ל-`Lead`: הרשימה היא קלט חד-פעמי ולא ישות במערכת.
model EmailCampaign {
  id String @id @default(cuid())

  /// שם פנימי, למסך בלבד
  name String

  /// התבנית **לפני** מיזוג, כפי שהמשתמש כתב אותה. נשמרת לתיעוד
  /// ולשכפול דיוור — לא לשליחה. מה שנשלח יושב ב-`EmailMessage`.
  subjectTemplate String
  bodyTemplate    String

  status EmailCampaignStatus @default(draft)

  /// נקבע ביצירה ולא משתנה. שאר המונים (נשלחו/נכשלו/ממתינים) נספרים
  /// מ-`EmailMessage` ולא נשמרים בשדה — שדה כזה יכול לסתור את התור.
  totalCount Int @default(0)

  createdById String?
  createdBy   User?   @relation("EmailCampaignCreator", fields: [createdById], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now())

  messages EmailMessage[]

  @@index([status, createdAt])
}

/// שורה בתור המיילים היוצאים.
///
/// ⚠️ `subject` ו-`body` הם snapshot מרונדר ולא נגזרים בזמן השליחה,
/// מאותה סיבה שכתובה ב-`WhatsAppMessage`: אחרי שהמייל יצא, מה שנשלח
/// הוא עובדה היסטורית שלא משתנה כשעורכים את הקמפיין.
model EmailMessage {
  id String @id @default(cuid())

  /// `campaign:<campaignId>:<מייל מנורמל>`. זה מה שהופך העלאה כפולה
  /// של אותו קובץ ל-no-op, וגם כתובת שמופיעה פעמיים בקובץ נכנסת פעם אחת.
  dedupeKey String @unique

  campaignId String
  campaign   EmailCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  /// מנורמל (`normalizeEmail`), כי הוא חלק ממפתח הכפילות
  toEmail String
  toName  String?

  subject String
  body    String

  status       EmailMessageStatus @default(queued)
  scheduledFor DateTime
  /// עולה בכל תביעה. 3 כישלונות = failed.
  attempts     Int                @default(0)
  lastError    String?
  claimedAt    DateTime?
  sentAt       DateTime?

  createdAt DateTime @default(now())

  @@index([status, scheduledFor])
  @@index([campaignId, status])
}

/// מי ביקש להסיר את עצמו. מקביל ל-`RenewalOptOut`.
///
/// ⚠️ נבדק פעמיים — בהעלאה ושוב ברגע התביעה. בין השתיים עוברות שעות,
/// ומי שהסיר את עצמו באמצע לא אמור לקבל את שאר הדיוור.
model EmailOptOut {
  /// המייל המנורמל הוא המפתח
  email     String   @id
  reason    String?
  createdAt DateTime @default(now())
}

/// הגדרות הדיוור — שורה יחידה (`id = "default"`), במקביל ל-`BotSettings`.
///
/// במסד ולא בקוד מאותה סיבה: עצירת דיוור שיצא לא נכון חייבת להיות
/// לחיצה אחת, ומחזור פריסה של Vercel הוא דקות.
model MailerSettings {
  id String @id @default("default")

  paused       Boolean   @default(false)
  pausedReason String?
  pausedAt     DateTime?

  /// חלון שליחה בשעון ישראל. דיוור שיוצא ב-03:00 נראה כמו ספאם.
  sendWindowStartHour Int @default(8)
  sendWindowEndHour   Int @default(21)

  /// תקרה ליום קלנדרי (שעון ישראל). 400 ולא 500 — מתחת לתקרה של
  /// גוגל, כי חשבון שנשרף אינו ניתן לשחזור. 0 = בלי תקרה.
  dailyCap Int @default(400)

  /// כמה מיילים לתקתוק אחד. Gmail חוסם התפרצויות, ולכן לא שולחים
  /// את כל הרשימה בבת אחת גם כשהתקרה מרשה.
  perTick Int @default(20)

  updatedAt   DateTime @updatedAt
  updatedById String?
}
```

- [ ] **Step 2: להוסיף את יחס הצד השני ב-`User`**

במודל `User` (מתחיל בשורה 55), לצד שאר ה-relations:

```prisma
  emailCampaigns EmailCampaign[] @relation("EmailCampaignCreator")
```

- [ ] **Step 3: להוסיף את משתני הסביבה ל-`.env.example`**

בסוף `.env.example`:

```bash
# ─── דיוור במייל (/mailer) ────────────────────────────────────────────
# שליחה דרך חשבון Gmail עם **סיסמת אפליקציה** (לא סיסמת החשבון).
# דורש אימות דו-שלבי פעיל, ואז myaccount.google.com/apppasswords.
#
# ⚠️ למה Gmail ולא ספק דיוור: כתובת gmail.com ששולחת דרך שרתי ספק
# צד-שלישי אינה עוברת יישור SPF/DKIM ונוחתת בספאם. שליחה מ-Gmail
# דרך Gmail מיושרת. המחיר: ~500 ליום ואין דוחות פתיחה.
#
# בלי שני אלה המסך עולה אבל שום דבר לא יוצא.
GMAIL_USER=""
GMAIL_APP_PASSWORD=""

# הסוד שחותם על קישורי ההסרה מרשימת התפוצה.
# ⚠️ החלפתו מבטלת כל קישור הסרה שכבר נשלח — מי שילחץ יקבל "קישור לא
# תקין" ולא יוכל להסיר את עצמו. זו חשיפה חוקית, לא אי-נוחות.
# ייצור: node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
MAILER_SECRET=""
```

- [ ] **Step 4: להריץ מיגרציה ולוודא שהטיפוסים נוצרו**

```bash
npx prisma migrate dev --name email-mailer
```

Expected: מיגרציה חדשה תחת `prisma/migrations/`, ו-`prisma generate` רץ אוטומטית.

```bash
npm run typecheck
```

Expected: ללא שגיאות.

- [ ] **Step 5: קומיט**

```bash
git add prisma/schema.prisma prisma/migrations .env.example
git commit -m "סכימת הדיוור: קמפיין, תור, הסרה מרשימה והגדרות"
```

---

### Task 2: נרמול ותיקוף כתובות מייל

**Files:**
- Create: `src/lib/email.ts`
- Test: `tools/email.test.mjs`

**Interfaces:**
- Consumes: אין
- Produces:
  - `normalizeEmail(raw: string): string | null` — מחזיר כתובת מנורמלת או `null` אם אינה תקינה
  - `isEmail(value: string): boolean`

- [ ] **Step 1: לכתוב את הבדיקה הנכשלת**

`tools/email.test.mjs`:

```js
import assert from "node:assert/strict";
import { test } from "node:test";

import { isEmail, normalizeEmail } from "../src/lib/email.ts";

test("מייל: רווחים ואותיות גדולות מנורמלים", () => {
  assert.equal(normalizeEmail("  Dana@Gmail.COM "), "dana@gmail.com");
  assert.equal(normalizeEmail("A.B@Example.Co.IL"), "a.b@example.co.il");
});

test("מייל: הצורה שאאוטלוק מדביק — סוגריים משולשים — מתקלפת", () => {
  assert.equal(normalizeEmail("<dana@gmail.com>"), "dana@gmail.com");
  assert.equal(normalizeEmail('"דנה" <dana@gmail.com>'), "dana@gmail.com");
});

test("מייל: מה שאינו כתובת מוחזר null ולא מתוקן בכוח", () => {
  // ⚠️ זו הסכנה האמיתית: לנחש כתובת מתא פגום ולשלוח לאדם אחר.
  assert.equal(normalizeEmail("dana@gmail"), null);
  assert.equal(normalizeEmail("dana at gmail.com"), null);
  assert.equal(normalizeEmail("dana@@gmail.com"), null);
  assert.equal(normalizeEmail("dana@gmail..com"), null);
  assert.equal(normalizeEmail("@gmail.com"), null);
  assert.equal(normalizeEmail("dana@.com"), null);
  assert.equal(normalizeEmail(""), null);
  assert.equal(normalizeEmail("   "), null);
});

test("מייל: תא שמכיל שתי כתובות נדחה ולא נחתך לראשונה", () => {
  // חיתוך שקט היה שולח לאחד ומשמיט את השני בלי שאיש ידע
  assert.equal(normalizeEmail("a@b.com, c@d.com"), null);
  assert.equal(normalizeEmail("a@b.com; c@d.com"), null);
});

test("מייל: isEmail עקבי עם normalizeEmail", () => {
  assert.equal(isEmail("Dana@Gmail.COM"), true);
  assert.equal(isEmail("dana@gmail"), false);
});
```

- [ ] **Step 2: להריץ ולוודא כישלון**

```bash
npx tsx --test tools/email.test.mjs
```

Expected: FAIL — `Cannot find module` על `../src/lib/email.ts`

- [ ] **Step 3: לממש**

`src/lib/email.ts`:

```ts
/**
 * נרמול ותיקוף כתובות מייל, לצורך דיוור.
 *
 * ⚠️ **הנרמול הוא חלק ממפתח הכפילות** (`dedupeKey`), ולכן שתי צורות
 * של אותה כתובת חייבות להצטמצם לאחת — אחרת `Dana@` ו-`dana@` היו
 * שתי שורות בתור והאדם היה מקבל את הדיוור פעמיים.
 *
 * ⚠️ **מה שאינו כתובת מוחזר `null` ולא מתוקן בכוח.** בייבוא לידים
 * מותר להשלים אפס מוביל לטלפון, כי מספר פגום נכשל בשליחה ותו לא.
 * כתובת מייל מנוחשת נשלחת בהצלחה — לאדם אחר.
 */

/*
 * מכוון להיות מחמיר יותר מ-RFC 5322 ולא פחות: המקרים שהוא פוסל
 * (רווחים, פסיקים, נקודה כפולה, tld חסר) הם בדיוק מה שמגיע מתא
 * אקסל שמולא ביד, ולא כתובות אמיתיות שנדחות בטעות.
 */
const SHAPE = /^[^\s@,;<>]+@[^\s@,;<>.]+(\.[^\s@,;<>.]+)+$/;

/**
 * מקלף את העטיפה שאאוטלוק ו-Gmail מדביקים: `"שם" <a@b.com>`.
 * מוחזר הטקסט שבין הסוגריים, או המקור אם אין כאלה.
 */
function unwrapAngleBrackets(value: string): string {
  const m = /<([^<>]*)>\s*$/.exec(value);
  return m ? m[1].trim() : value;
}

/** הכתובת בצורתה הקנונית, או `null` אם אינה תקינה. */
export function normalizeEmail(raw: string): string | null {
  const candidate = unwrapAngleBrackets(raw.trim()).trim().toLowerCase();
  if (!SHAPE.test(candidate)) return null;
  return candidate;
}

export function isEmail(value: string): boolean {
  return normalizeEmail(value) !== null;
}
```

- [ ] **Step 4: להריץ ולוודא הצלחה**

```bash
npx tsx --test tools/email.test.mjs
```

Expected: PASS — 5 בדיקות

- [ ] **Step 5: קומיט**

```bash
git add src/lib/email.ts tools/email.test.mjs
git commit -m "נרמול ותיקוף כתובות מייל, בלי ניחוש כתובת מתא פגום"
```

---

### Task 3: שדות מיזוג

**Files:**
- Create: `src/lib/domain/mailMerge.ts`
- Test: `tools/mailMerge.test.mjs`

**Interfaces:**
- Consumes: אין
- Produces:
  - `mergeFieldsIn(template: string): string[]` — שמות השדות שהתבנית משתמשת בהם, בסדר הופעה, בלי כפילויות
  - `renderMerge(template: string, values: Record<string, string>): string`
  - `emptyFieldsIn(template: string, values: Record<string, string>): string[]` — השדות שהתבנית דורשת ושהערך שלהם חסר או ריק

- [ ] **Step 1: לכתוב את הבדיקה הנכשלת**

`tools/mailMerge.test.mjs`:

```js
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  emptyFieldsIn,
  mergeFieldsIn,
  renderMerge,
} from "../src/lib/domain/mailMerge.ts";

test("מיזוג: שדה מוחלף בערך", () => {
  assert.equal(
    renderMerge("שלום {{שם}}, יש לנו מבצע", { שם: "דנה" }),
    "שלום דנה, יש לנו מבצע",
  );
});

test("מיזוג: רווחים בתוך הסוגריים לא שוברים את ההתאמה", () => {
  assert.equal(renderMerge("שלום {{ שם }}", { שם: "דנה" }), "שלום דנה");
});

test("מיזוג: אותו שדה פעמיים מוחלף בשתיהן", () => {
  assert.equal(renderMerge("{{שם}} ו{{שם}}", { שם: "דנה" }), "דנה ודנה");
});

test("מיזוג: שדה חסר הופך למחרוזת ריקה ולא נשאר כסוגריים", () => {
  // ⚠️ "שלום {{שם}}" שיוצא כמו שהוא ללקוח נראה כמו תקלה במערכת.
  // ריק מכוער פחות — והמסך סופר את השורות האלה לפני השליחה.
  assert.equal(renderMerge("שלום {{שם}}!", {}), "שלום !");
  assert.equal(renderMerge("שלום {{שם}}!", { שם: "  " }), "שלום !");
});

test("מיזוג: ערך שמכיל סוגריים אינו מורחב שוב", () => {
  // אחרת ערך מתא בקובץ היה יכול לשלוף שדה אחר
  assert.equal(
    renderMerge("{{שם}}", { שם: "{{סוד}}", סוד: "1234" }),
    "{{סוד}}",
  );
});

test("מיזוג: רשימת השדות בסדר הופעה ובלי כפילויות", () => {
  assert.deepEqual(mergeFieldsIn("{{שם}} {{עיר}} {{שם}}"), ["שם", "עיר"]);
  assert.deepEqual(mergeFieldsIn("בלי שדות"), []);
});

test("מיזוג: השדות הריקים מדווחים, כדי שהמסך יספור אותם", () => {
  assert.deepEqual(emptyFieldsIn("{{שם}} {{עיר}}", { שם: "דנה" }), ["עיר"]);
  assert.deepEqual(emptyFieldsIn("{{שם}}", { שם: "דנה" }), []);
  assert.deepEqual(emptyFieldsIn("{{שם}}", { שם: "" }), ["שם"]);
});
```

- [ ] **Step 2: להריץ ולוודא כישלון**

```bash
npx tsx --test tools/mailMerge.test.mjs
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: לממש**

`src/lib/domain/mailMerge.ts`:

```ts
/**
 * שדות מיזוג בתבנית הדיוור — `{{שם}}`.
 *
 * ⚠️ **מעבר יחיד על התבנית, בלי הרחבה חוזרת של הערכים.** ערך מגיע
 * מתא בקובץ שמישהו העלה; אילו היה מורחב שוב, תא שמכיל `{{...}}` היה
 * שולף שדה אחר של אותו נמען לתוך הטקסט.
 *
 * ⚠️ **שדה חסר הופך למחרוזת ריקה ולא נשאר כסוגריים.** תבנית שיוצאת
 * ללקוח כמו שהיא נראית כמו תקלה. במקום לתקן בזמן השליחה, המסך סופר
 * מראש כמה שורות ייצאו עם שדה ריק ומציג את זה לפני האישור —
 * `emptyFieldsIn` קיים בשביל הספירה ההיא.
 */

/** `{{שם}}` וגם `{{ שם }}`. השם הוא כל מה שאינו סוגר או סוגריים. */
const FIELD = /\{\{\s*([^{}]+?)\s*\}\}/g;

/** שמות השדות שהתבנית משתמשת בהם, בסדר הופעה ובלי כפילויות. */
export function mergeFieldsIn(template: string): string[] {
  const seen = new Set<string>();
  for (const m of template.matchAll(FIELD)) seen.add(m[1]);
  return [...seen];
}

/** ממזג את הערכים לתוך התבנית. מעבר אחד בלבד. */
export function renderMerge(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(FIELD, (_all, name: string) => {
    const value = values[name];
    return value === undefined ? "" : value.trim();
  });
}

/** השדות שהתבנית דורשת ושאין להם ערך של ממש. */
export function emptyFieldsIn(
  template: string,
  values: Record<string, string>,
): string[] {
  return mergeFieldsIn(template).filter(
    (name) => (values[name] ?? "").trim() === "",
  );
}
```

- [ ] **Step 4: להריץ ולוודא הצלחה**

```bash
npx tsx --test tools/mailMerge.test.mjs
```

Expected: PASS — 7 בדיקות

- [ ] **Step 5: קומיט**

```bash
git add src/lib/domain/mailMerge.ts tools/mailMerge.test.mjs
git commit -m "שדות מיזוג: מעבר יחיד, שדה חסר ריק, והשדות הריקים מדווחים"
```

---

### Task 4: טוקן ההסרה מרשימת התפוצה

**Files:**
- Create: `src/lib/unsubscribeToken.ts`
- Test: `tools/unsubscribeToken.test.mjs`

**Interfaces:**
- Consumes: `normalizeEmail` מ-`@/lib/email` (משימה 2)
- Produces:
  - `signUnsubscribe(email: string, secret: string): string`
  - `verifyUnsubscribe(token: string, secret: string): string | null` — מחזיר את המייל המנורמל, או `null`

- [ ] **Step 1: לכתוב את הבדיקה הנכשלת**

`tools/unsubscribeToken.test.mjs`:

```js
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  signUnsubscribe,
  verifyUnsubscribe,
} from "../src/lib/unsubscribeToken.ts";

const SECRET = "test-secret-do-not-use";

test("הסרה: טוקן חוזר לכתובת שממנה נוצר", () => {
  const token = signUnsubscribe("Dana@Gmail.com", SECRET);
  assert.equal(verifyUnsubscribe(token, SECRET), "dana@gmail.com");
});

test("הסרה: הטוקן בטוח לשימוש בכתובת URL", () => {
  const token = signUnsubscribe("a.b+c@example.co.il", SECRET);
  assert.equal(token, encodeURIComponent(token));
});

test("הסרה: טוקן שנערך נדחה", () => {
  const token = signUnsubscribe("dana@gmail.com", SECRET);
  const [payload, sig] = token.split(".");

  // חתימה שהוחלפה
  assert.equal(verifyUnsubscribe(`${payload}.${sig}x`, SECRET), null);
  // מטען שהוחלף, חתימה מקורית — הניסיון להסיר מישהו אחר
  const other = Buffer.from("boss@onestop.co.il").toString("base64url");
  assert.equal(verifyUnsubscribe(`${other}.${sig}`, SECRET), null);
});

test("הסרה: טוקן מסוד אחר נדחה", () => {
  const token = signUnsubscribe("dana@gmail.com", SECRET);
  assert.equal(verifyUnsubscribe(token, "אחר"), null);
});

test("הסרה: זבל אינו מפיל את הפונקציה", () => {
  // הטוקן מגיע משורת הכתובת ולכן הוא קלט של זר
  assert.equal(verifyUnsubscribe("", SECRET), null);
  assert.equal(verifyUnsubscribe("....", SECRET), null);
  assert.equal(verifyUnsubscribe("אין כאן נקודה", SECRET), null);
  assert.equal(verifyUnsubscribe("!!!.???", SECRET), null);
});

test("הסרה: כתובת פגומה אינה מקבלת טוקן", () => {
  assert.throws(() => signUnsubscribe("לא כתובת", SECRET));
});
```

- [ ] **Step 2: להריץ ולוודא כישלון**

```bash
npx tsx --test tools/unsubscribeToken.test.mjs
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: לממש**

`src/lib/unsubscribeToken.ts`:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

import { normalizeEmail } from "./email";

/**
 * הקישור להסרה מרשימת התפוצה, חתום.
 *
 * ⚠️ **חתימה ולא מזהה שנשמר במסד**, כי הקישור נשלח לאלפי כתובות
 * ונשאר תקף לנצח. שורה לכל מייל שנשלח אי-פעם היא טבלה שגדלה בלי
 * גבול ולא נמחקת לעולם; החתימה מאמתת את עצמה.
 *
 * ⚠️ **הטוקן מגיע משורת הכתובת ולכן הוא קלט של זר.** כל צורה פגומה
 * מחזירה `null`, ולא נזרקת שגיאה שתהפוך לדף 500 מול מי שרק רצה
 * להסיר את עצמו.
 *
 * ⚠️ ההשוואה היא `timingSafeEqual`. זה נראה מוגזם בשביל הסרה מרשימה,
 * אבל טוקן מזויף מאפשר להסיר לקוח אחר — כלומר למנוע ממנו לקבל דיוור
 * שהוא כן רצה — וזה כשל שקט שאיש לא ישים לב אליו.
 */

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** הטוקן לכתובת. זורק אם הכתובת אינה תקינה. */
export function signUnsubscribe(email: string, secret: string): string {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error(`כתובת לא תקינה לחתימה: ${email}`);

  const payload = Buffer.from(normalized, "utf8").toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

/** הכתובת שהטוקן מייצג, או `null` אם הוא אינו תקף. */
export function verifyUnsubscribe(
  token: string,
  secret: string,
): string | null {
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;

  const payload = token.slice(0, dot);
  const provided = token.slice(dot + 1);
  const expected = sign(payload, secret);

  // ⚠️ אורך שונה מפיל את `timingSafeEqual`, ולכן נבדק לפניו
  if (provided.length !== expected.length) return null;
  if (
    !timingSafeEqual(Buffer.from(provided, "utf8"), Buffer.from(expected, "utf8"))
  ) {
    return null;
  }

  return normalizeEmail(Buffer.from(payload, "base64url").toString("utf8"));
}
```

- [ ] **Step 4: להריץ ולוודא הצלחה**

```bash
npx tsx --test tools/unsubscribeToken.test.mjs
```

Expected: PASS — 6 בדיקות

- [ ] **Step 5: קומיט**

```bash
git add src/lib/unsubscribeToken.ts tools/unsubscribeToken.test.mjs
git commit -m "טוקן הסרה חתום, שמאמת את עצמו בלי טבלה שגדלה בלי גבול"
```

---

### Task 5: תבנית המייל

**Files:**
- Create: `src/lib/domain/mailTemplate.ts`
- Test: `tools/mailTemplate.test.mjs`

**Interfaces:**
- Consumes: אין
- Produces:
  - `renderMail(input: { subject: string; body: string; unsubscribeUrl: string }): { html: string; text: string }`

- [ ] **Step 1: לכתוב את הבדיקה הנכשלת**

`tools/mailTemplate.test.mjs`:

```js
import assert from "node:assert/strict";
import { test } from "node:test";

import { renderMail } from "../src/lib/domain/mailTemplate.ts";

const URL = "https://crm.example.com/unsubscribe/abc.def";

test("תבנית: הגוף עטוף RTL", () => {
  const { html } = renderMail({ subject: "מבצע", body: "שלום", unsubscribeUrl: URL });
  assert.match(html, /dir="rtl"/);
  assert.match(html, /<html[^>]*lang="he"/);
});

test("תבנית: HTML מהטקסט של המשתמש מנוטרל", () => {
  // ⚠️ הטקסט נכתב בשדה טקסט, לא בעורך HTML. תגית שנכנסה בטעות
  // (או הדבקה מוורד) לא אמורה להפוך לסימון.
  const { html } = renderMail({
    subject: "x",
    body: '<script>alert(1)</script> & <b>מודגש</b>',
    unsubscribeUrl: URL,
  });
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<b>מודגש<\/b>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&amp;/);
});

test("תבנית: שורה ריקה פותחת פסקה, שורה בודדת היא ירידת שורה", () => {
  const { html } = renderMail({
    subject: "x",
    body: "שורה א\nשורה ב\n\nפסקה שנייה",
    unsubscribeUrl: URL,
  });
  assert.match(html, /שורה א<br \/>שורה ב/);
  assert.equal(html.match(/<p /g).length, 2);
});

test("תבנית: קישור ההסרה בשתי הגרסאות", () => {
  const { html, text } = renderMail({ subject: "x", body: "שלום", unsubscribeUrl: URL });
  assert.ok(html.includes(URL));
  assert.ok(text.includes(URL));
});

test("תבנית: גרסת הטקסט היא הטקסט המקורי, בלי תגיות", () => {
  // ⚠️ הודעה בלי text/plain מקבלת ניקוד ספאם גבוה יותר
  const { text } = renderMail({
    subject: "x",
    body: "שלום דנה",
    unsubscribeUrl: URL,
  });
  assert.ok(text.startsWith("שלום דנה"));
  assert.doesNotMatch(text, /</);
});

test("תבנית: הנושא נכנס לכותרת המסמך, מנוטרל אף הוא", () => {
  const { html } = renderMail({
    subject: '<b>מבצע</b>',
    body: "שלום",
    unsubscribeUrl: URL,
  });
  assert.match(html, /<title>&lt;b&gt;מבצע/);
});
```

- [ ] **Step 2: להריץ ולוודא כישלון**

```bash
npx tsx --test tools/mailTemplate.test.mjs
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: לממש**

`src/lib/domain/mailTemplate.ts`:

```ts
/**
 * העטיפה שכל דיוור יוצא בתוכה.
 *
 * ⚠️ **הטקסט של המשתמש מנוטרל ולא מסומן.** הוא נכתב בשדה טקסט ולא
 * בעורך HTML; תגית שנכנסה בהדבקה מוורד היא תקלה, לא כוונה.
 *
 * ⚠️ **סגנון בתוך התגיות (`style=`) ולא בגיליון.** לקוחות מייל —
 * ובראשם Gmail — מסלקים או מתעלמים מ-`<style>` בראש המסמך. זה נראה
 * כמו קוד מיושן והוא בדיוק ההפך: זה מה שעובד.
 *
 * ⚠️ **גרסת טקסט נקי נשלחת תמיד.** הודעה בלי `text/plain` מקבלת
 * ניקוד ספאם גבוה יותר, וזו התוצאה שלא רואים — הדוח אומר "נשלח".
 */

const INK = "#1f2933";
const MUTED = "#6b7280";
const BRAND = "#c9a227";
const PAPER = "#ffffff";
const BACKDROP = "#f4f2ed";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * טקסט → פסקאות. שורה ריקה מפרידה פסקה, שורה בודדת היא ירידת שורה
 * בתוכה. זה בדיוק מה שמישהו שמקליד בשדה טקסט מצפה שיקרה.
 */
function paragraphs(body: string): string {
  return body
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map(
      (block) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:${INK}">` +
        escapeHtml(block).replace(/\n/g, "<br />") +
        `</p>`,
    )
    .join("");
}

export interface RenderedMail {
  html: string;
  text: string;
}

export function renderMail(input: {
  subject: string;
  body: string;
  unsubscribeUrl: string;
}): RenderedMail {
  const url = escapeHtml(input.unsubscribeUrl);

  const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(input.subject)}</title>
</head>
<body style="margin:0;padding:24px 12px;background:${BACKDROP};font-family:Arial,Helvetica,sans-serif" dir="rtl">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;border-collapse:collapse;background:${PAPER};border-top:4px solid ${BRAND};border-radius:8px">
<tr><td style="padding:32px 28px" dir="rtl">
${paragraphs(input.body)}
</td></tr>
<tr><td style="padding:0 28px 28px" dir="rtl">
<hr style="border:0;border-top:1px solid #e5e7eb;margin:0 0 12px" />
<p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED}">
קיבלת את ההודעה הזו מ-ONE STOP.
<a href="${url}" style="color:${MUTED}">להסרה מרשימת התפוצה</a>
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = `${input.body.trim()}

—
קיבלת את ההודעה הזו מ-ONE STOP.
להסרה מרשימת התפוצה: ${input.unsubscribeUrl}`;

  return { html, text };
}
```

- [ ] **Step 4: להריץ ולוודא הצלחה**

```bash
npx tsx --test tools/mailTemplate.test.mjs
```

Expected: PASS — 6 בדיקות

- [ ] **Step 5: קומיט**

```bash
git add src/lib/domain/mailTemplate.ts tools/mailTemplate.test.mjs
git commit -m "עטיפת המייל: RTL, טקסט מנוטרל, וגרסת טקסט נקי"
```

---

### Task 6: הספק — nodemailer מאחורי פונקציה אחת

**Files:**
- Create: `src/server/mailer/provider.ts`
- Modify: `package.json` (תלות `nodemailer`)

**Interfaces:**
- Consumes: אין
- Produces:
  - `mailerConfigured(): boolean`
  - `mailerSenderAddress(): string | null`
  - `sendMail(input: { to: string; subject: string; html: string; text: string; unsubscribeUrl: string }): Promise<string>` — מחזיר `messageId`, זורק בכישלון

- [ ] **Step 1: להתקין את התלות**

```bash
npm install nodemailer && npm install --save-dev @types/nodemailer
```

- [ ] **Step 2: לממש**

`src/server/mailer/provider.ts`:

```ts
import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

/**
 * השליחה בפועל — **המקום היחיד** שיודע מי הספק.
 *
 * ⚠️ Gmail ולא שירות דיוור, בכוונה: כתובת `gmail.com` ששולחת דרך
 * שרתי ספק צד-שלישי אינה עוברת יישור SPF/DKIM מול הדומיין, ונוחתת
 * בספאם. זה כישלון שלא רואים — הדוח אומר "נשלח" ואיש לא קרא.
 * המחיר הוא תקרה של ~500 ליום ואפס דוחות פתיחה, וזה מה שקבע את
 * התקרה היומית ב-`MAILER_DEFAULTS`.
 *
 * ⚠️ מעבר לספק אמיתי (דומיין מאומת + Resend/Brevo) הוא החלפת הקובץ
 * הזה בלבד. שום מודול אחר לא מכיר את nodemailer.
 */

/** מחזיק מופע אחד — פתיחת חיבור SMTP לכל מייל מאיטה ומעצבנת את גוגל. */
let cached: Transporter | null = null;

function credentials(): { user: string; pass: string } | null {
  const user = process.env.GMAIL_USER?.trim();
  // ⚠️ גוגל מציגה את הסיסמה בארבע רביעיות מופרדות ברווח, ומי
  // שמעתיק אותה מדביק את הרווחים. SMTP דוחה אותם בשקט.
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  if (!user || !pass) return null;
  return { user, pass };
}

/** האם יש מה לשלוח איתו. המסך בודק את זה לפני שהוא מרשה לשלוח. */
export function mailerConfigured(): boolean {
  return credentials() !== null;
}

export function mailerSenderAddress(): string | null {
  return credentials()?.user ?? null;
}

function transport(): Transporter {
  const creds = credentials();
  if (!creds) {
    throw new Error(
      "GMAIL_USER או GMAIL_APP_PASSWORD חסרים — ראה .env.example",
    );
  }

  cached ??= nodemailer.createTransport({
    host: "smtp.gmail.com",
    // 465 ולא 587: TLS מהשנייה הראשונה, בלי STARTTLS שנופל
    // בסביבות שחוסמות שדרוג חיבור
    port: 465,
    secure: true,
    auth: creds,
  });

  return cached;
}

/** שולח מייל אחד. מחזיר את מזהה ההודעה, או זורק. */
export async function sendMail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl: string;
}): Promise<string> {
  const info = await transport().sendMail({
    from: mailerSenderAddress() ?? undefined,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    headers: {
      /*
       * ⚠️ שתי הכותרות יחד, ולא רק הראשונה. בלי `-Post` ג'ימייל
       * מתייחס לקישור כאל דף שצריך לפתוח ולרוב אינו מציג את הכפתור
       * המובנה שלו; עם שתיהן הוא שולח POST ומסיר במקום. מי שלוחץ
       * עליו הוא מי שאחרת היה מסמן "דווח כספאם" — וזה ההבדל בין
       * הסרה בודדת לבין פגיעה במוניטין של החשבון כולו.
       */
      "List-Unsubscribe": `<${input.unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });

  return info.messageId;
}
```

- [ ] **Step 3: לוודא שהפרויקט מתקמפל ושהבדיקות עדיין ירוקות**

```bash
npm run typecheck && npm test
```

Expected: ללא שגיאות, `fail 0` — כל הבדיקות ירוקות

- [ ] **Step 4: קומיט**

```bash
git add package.json package-lock.json src/server/mailer/provider.ts
git commit -m "ספק השליחה: Gmail SMTP מאחורי sendMail, עם כותרות הסרה"
```

---

### Task 7: הגדרות הדיוור

**Files:**
- Create: `src/server/mailer/settings.ts`

**Interfaces:**
- Consumes: `prisma` מ-`@/server/db/client`, המודל `MailerSettings` (משימה 1)
- Produces:
  - `interface MailerSettingsView { paused, pausedReason, pausedAt, sendWindowStartHour, sendWindowEndHour, dailyCap, perTick }`
  - `MAILER_DEFAULTS: MailerSettingsView`
  - `readMailerSettings(): Promise<MailerSettingsView>`
  - `writeMailerSettings(patch, actorId): Promise<void>`

- [ ] **Step 1: לממש**

`src/server/mailer/settings.ts`:

```ts
import "server-only";

import { prisma } from "@/server/db/client";

/**
 * הגדרות הדיוור, במקביל ל-`src/server/whatsapp/settings.ts`.
 *
 * במסד ולא בקוד מאותה סיבה בדיוק: כשמתברר שדיוור יצא שגוי, העצירה
 * חייבת להיות לחיצה אחת. מחזור פריסה של Vercel הוא דקות, ובדקות
 * האלה המיילים ממשיכים לצאת.
 */

export interface MailerSettingsView {
  paused: boolean;
  pausedReason: string | null;
  pausedAt: Date | null;
  sendWindowStartHour: number;
  sendWindowEndHour: number;
  dailyCap: number;
  perTick: number;
}

/**
 * ⚠️ קיימות כאן ולא רק כ-`@default` בסכימה, כי השורה עשויה לא
 * להתקיים — מסד טרי, או לפני שמנהל נגע בהגדרות פעם ראשונה.
 *
 * ⚠️ `dailyCap` הוא 400 ולא 500: התקרה של גוגל היא כ-500, וחשבון
 * שנשרף אינו ניתן לשחזור. המרווח הוא רשת הביטחון היחידה מפני באג
 * שמייצר לולאת שליחה.
 */
export const MAILER_DEFAULTS: MailerSettingsView = {
  paused: false,
  pausedReason: null,
  pausedAt: null,
  sendWindowStartHour: 8,
  sendWindowEndHour: 21,
  dailyCap: 400,
  perTick: 20,
};

export async function readMailerSettings(): Promise<MailerSettingsView> {
  const row = await prisma.mailerSettings.findUnique({
    where: { id: "default" },
    select: {
      paused: true,
      pausedReason: true,
      pausedAt: true,
      sendWindowStartHour: true,
      sendWindowEndHour: true,
      dailyCap: true,
      perTick: true,
    },
  });

  return row ?? MAILER_DEFAULTS;
}

/** `upsert` ולא `update` — השורה נוצרת בשינוי הראשון, בלי מיגרציית seed. */
export async function writeMailerSettings(
  patch: Partial<
    Pick<
      MailerSettingsView,
      | "paused"
      | "pausedReason"
      | "sendWindowStartHour"
      | "sendWindowEndHour"
      | "dailyCap"
      | "perTick"
    >
  > & { pausedAt?: Date | null },
  actorId: string,
): Promise<void> {
  await prisma.mailerSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...patch, updatedById: actorId },
    update: { ...patch, updatedById: actorId },
  });
}
```

- [ ] **Step 2: לוודא קומפילציה**

```bash
npm run typecheck
```

Expected: ללא שגיאות

- [ ] **Step 3: קומיט**

```bash
git add src/server/mailer/settings.ts
git commit -m "הגדרות הדיוור במסד, כדי שעצירה תהיה לחיצה ולא פריסה"
```

---

### Task 8: התור — הכנסה, תביעה, דיווח

**Files:**
- Create: `src/server/mailer/outbox.ts`

**Interfaces:**
- Consumes: `readMailerSettings`, `MailerSettingsView` (משימה 7); `normalizeEmail` (משימה 2); `renderMerge` (משימה 3); `insideSendWindow` מ-`@/server/whatsapp/outbox`; `startOfDay` מ-`@/lib/tz`
- Produces:
  - `interface RecipientInput { email: string; name: string; fields: Record<string, string> }`
  - `interface EnqueueResult { campaignId: string; queued: number; invalid: number; duplicate: number; optedOut: number }`
  - `enqueueCampaign(input: { name, subjectTemplate, bodyTemplate, createdById, recipients: RecipientInput[] }): Promise<EnqueueResult>`
  - `roomForTick(limits: { perTick: number; dailyCap: number }, sentToday: number): number` — נמצא ב-`src/lib/domain/mailRate.ts` ולא ב-`outbox.ts`, כי `outbox.ts` מייבא `server-only` ו-`prisma` ולכן אינו ניתן לייבוא מבדיקה
  - `interface ClaimedMail { id: string; toEmail: string; subject: string; body: string }`
  - `claimMail(settings: MailerSettingsView): Promise<ClaimedMail[]>`
  - `reportMail(id: string, error: string | null): Promise<void>`
  - `sentMailToday(): Promise<number>`

- [ ] **Step 1: לכתוב את הבדיקה הנכשלת של חשבון התקרה**

`tools/mailRate.test.mjs`:

```js
import assert from "node:assert/strict";
import { test } from "node:test";

import { roomForTick } from "../src/lib/domain/mailRate.ts";

test("תקרה: הקצב לתקתוק הוא הגבול כשהתקרה רחוקה", () => {
  assert.equal(roomForTick({ perTick: 20, dailyCap: 400 }, 0), 20);
  assert.equal(roomForTick({ perTick: 20, dailyCap: 400 }, 100), 20);
});

test("תקרה: קרוב לתקרה — נשאר רק מה שנותר", () => {
  assert.equal(roomForTick({ perTick: 20, dailyCap: 400 }, 395), 5);
});

test("תקרה: על התקרה ומעליה — אפס, ולעולם לא שלילי", () => {
  // ⚠️ מספר שלילי היה מגיע ל-`take` של Prisma ומפיל את הניקוז
  assert.equal(roomForTick({ perTick: 20, dailyCap: 400 }, 400), 0);
  assert.equal(roomForTick({ perTick: 20, dailyCap: 400 }, 999), 0);
});

test("תקרה: 0 = בלי תקרה יומית, הקצב לתקתוק עדיין חל", () => {
  assert.equal(roomForTick({ perTick: 20, dailyCap: 0 }, 10_000), 20);
});

test("תקרה: הגדרה מעוותת לא פותחת את הברז", () => {
  assert.equal(roomForTick({ perTick: -5, dailyCap: 400 }, 0), 0);
});
```

- [ ] **Step 2: להריץ ולוודא כישלון**

```bash
npx tsx --test tools/mailRate.test.mjs
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: לממש את חשבון התקרה**

`src/lib/domain/mailRate.ts`:

```ts
/**
 * כמה מיילים מותר לתבוע בתקתוק אחד.
 *
 * ⚠️ **פונקציה טהורה בקובץ נפרד**, ולא שורה בתוך `claimMail`. שם היא
 * הייתה מוגנת רק בייבוא של `prisma` ו-`server-only` — כלומר בלתי
 * ניתנת לבדיקה — וזה בדיוק החשבון שאסור לו להישבר: תוצאה שלילית
 * מגיעה ל-`take` של Prisma ומפילה את הניקוז, ותוצאה גדולה מדי שורפת
 * את מכסת ה-Gmail.
 */
export function roomForTick(
  limits: { perTick: number; dailyCap: number },
  sentToday: number,
): number {
  const perTick = Math.max(0, limits.perTick);
  if (limits.dailyCap <= 0) return perTick;
  return Math.max(0, Math.min(perTick, limits.dailyCap - sentToday));
}
```

- [ ] **Step 4: להריץ ולוודא הצלחה**

```bash
npx tsx --test tools/mailRate.test.mjs
```

Expected: PASS — 5 בדיקות

- [ ] **Step 5: לממש את התור**

`src/server/mailer/outbox.ts`:

```ts
import "server-only";

import { prisma } from "@/server/db/client";
import { startOfDay } from "@/lib/tz";
import { normalizeEmail } from "@/lib/email";
import { renderMerge } from "@/lib/domain/mailMerge";
import { roomForTick } from "@/lib/domain/mailRate";
import { insideSendWindow } from "@/server/whatsapp/outbox";
import { readMailerSettings, type MailerSettingsView } from "./settings";

/**
 * מנוע התור של הדיוור.
 *
 * ⚠️ **`insideSendWindow` מיובא מתור הוואטסאפ ולא משוכפל.** אותו
 * חישוב בדיוק, ומימוש שני היה נראה תמים ומתפצל בשקט ברגע שמישהו
 * מתקן באג באחד מהם.
 */

/** מספר הניסיונות לפני ויתור, כדי ששורה תקועה לא תסתובב לנצח. */
const MAX_ATTEMPTS = 3;

/** המתנה לפני ניסיון חוזר אחרי כישלון. */
const RETRY_DELAY_MS = 60_000;

/** שורה שנתבעה ולא דווחה — התהליך נפל באמצע. משוחררת אחרי זה. */
const CLAIM_TIMEOUT_MS = 5 * 60_000;

export interface RecipientInput {
  email: string;
  name: string;
  fields: Record<string, string>;
}

export interface EnqueueResult {
  campaignId: string;
  queued: number;
  invalid: number;
  duplicate: number;
  optedOut: number;
}

/**
 * יוצר קמפיין ומכניס את כל הנמענים לתור, כשהגוף כבר מרונדר.
 *
 * ⚠️ **הרינדור כאן ולא בשליחה.** מה שיצא הוא עובדה היסטורית: עריכת
 * הקמפיין אחרי שחצי הרשימה קיבלה אינה משנה את מה שכבר נשלח, ומי
 * שמסתכל על השורה רואה בדיוק את מה שהאדם קרא.
 */
export async function enqueueCampaign(input: {
  name: string;
  subjectTemplate: string;
  bodyTemplate: string;
  createdById: string | null;
  recipients: RecipientInput[];
}): Promise<EnqueueResult> {
  const optedOut = new Set(
    (await prisma.emailOptOut.findMany({ select: { email: true } })).map(
      (r) => r.email,
    ),
  );

  const seen = new Set<string>();
  let invalid = 0;
  let duplicate = 0;
  let skippedOptOut = 0;

  const rows: {
    email: string;
    name: string;
    subject: string;
    body: string;
  }[] = [];

  for (const recipient of input.recipients) {
    const email = normalizeEmail(recipient.email);
    if (!email) {
      invalid++;
      continue;
    }
    if (optedOut.has(email)) {
      skippedOptOut++;
      continue;
    }
    if (seen.has(email)) {
      duplicate++;
      continue;
    }
    seen.add(email);

    // ⚠️ `שם` זמין תמיד, גם כשהקובץ לא כלל עמודת שם — התבנית הנפוצה
    // ביותר פותחת ב"שלום {{שם}}", ותבנית שנשברת על קובץ בלי שם
    // הייתה מכריחה לכתוב אותה מחדש.
    const values = { ...recipient.fields, שם: recipient.name };

    rows.push({
      email,
      name: recipient.name,
      subject: renderMerge(input.subjectTemplate, values),
      body: renderMerge(input.bodyTemplate, values),
    });
  }

  const campaign = await prisma.emailCampaign.create({
    data: {
      name: input.name,
      subjectTemplate: input.subjectTemplate,
      bodyTemplate: input.bodyTemplate,
      status: rows.length > 0 ? "sending" : "done",
      totalCount: rows.length,
      createdById: input.createdById,
    },
    select: { id: true },
  });

  const now = new Date();
  const { count } = await prisma.emailMessage.createMany({
    data: rows.map((row) => ({
      dedupeKey: `campaign:${campaign.id}:${row.email}`,
      campaignId: campaign.id,
      toEmail: row.email,
      toName: row.name || null,
      subject: row.subject,
      body: row.body,
      scheduledFor: now,
    })),
    // ⚠️ הכפילויות כבר סוננו למעלה; זו רשת ביטחון מפני הרצה כפולה
    // של אותה בקשה, לא תחליף לספירה שהמסך מציג.
    skipDuplicates: true,
  });

  return {
    campaignId: campaign.id,
    queued: count,
    invalid,
    duplicate,
    optedOut: skippedOptOut,
  };
}

/**
 * כמה מיילים כבר יצאו היום (שעון ישראל).
 *
 * נספרים `sent` **ו-`sending`** יחד: שורה שנתבעה ועדיין לא דווחה כבר
 * עזבה את השרת מבחינת התקרה. ספירת `sent` בלבד הייתה מאפשרת לחרוג
 * בגודל אצווה שלם בכל תקתוק.
 */
export async function sentMailToday(): Promise<number> {
  const dayStart = new Date(startOfDay(Date.now()));
  return prisma.emailMessage.count({
    where: {
      status: { in: ["sent", "sending"] },
      OR: [
        { sentAt: { gte: dayStart } },
        { sentAt: null, claimedAt: { gte: dayStart } },
      ],
    },
  });
}

/** משחררת שורות שנתבעו ואיש לא דיווח עליהן. */
async function reclaimAbandoned(): Promise<void> {
  await prisma.emailMessage.updateMany({
    where: {
      status: "sending",
      claimedAt: { lt: new Date(Date.now() - CLAIM_TIMEOUT_MS) },
    },
    data: { status: "queued", claimedAt: null },
  });
}

export interface ClaimedMail {
  id: string;
  toEmail: string;
  subject: string;
  body: string;
}

/**
 * תובעת שורות לשליחה.
 *
 * ⚠️ שלוש הבלימות הן "לא לתבוע" ולא "לבטל": התור נשמר וממשיך
 * להתנקז כשהתנאי חוזר, בדיוק כמו בתור הוואטסאפ.
 *
 * ⚠️ **התביעה היא `updateMany` מותנה על `status: "queued"`,** ולכן
 * שתי הרצות במקביל אינן שולחות את אותה שורה פעמיים. זה מה שמאפשר
 * לתלות את הניקוז על תקתוק קיים בלי לפחד מחפיפה.
 */
export async function claimMail(
  settings: MailerSettingsView,
): Promise<ClaimedMail[]> {
  if (settings.paused) return [];
  if (!insideSendWindow(Date.now(), settings)) return [];

  await reclaimAbandoned();

  const room = roomForTick(settings, await sentMailToday());
  if (room <= 0) return [];

  const candidates = await prisma.emailMessage.findMany({
    where: { status: "queued", scheduledFor: { lte: new Date() } },
    orderBy: { scheduledFor: "asc" },
    take: room,
    select: { id: true },
  });

  const claimed: ClaimedMail[] = [];
  for (const { id } of candidates) {
    const { count } = await prisma.emailMessage.updateMany({
      where: { id, status: "queued" },
      data: {
        status: "sending",
        claimedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
    if (count === 0) continue; // מופע אחר הקדים — לא שלנו

    const row = await prisma.emailMessage.findUnique({
      where: { id },
      select: { id: true, toEmail: true, subject: true, body: true },
    });
    if (row) claimed.push(row);
  }

  return claimed;
}

/**
 * מדווחת תוצאה. `error === null` = הצלחה.
 *
 * ⚠️ כישלון חוזר לתור עד `MAX_ATTEMPTS`, ואחריו `failed`. שורה
 * שממשיכה לנסות לנצח היא שורה שאיש לא רואה שנתקעה.
 */
export async function reportMail(
  id: string,
  error: string | null,
): Promise<void> {
  if (!error) {
    await prisma.emailMessage.update({
      where: { id },
      data: { status: "sent", sentAt: new Date(), lastError: null },
    });
    await closeCampaignIfDone(id);
    return;
  }

  const row = await prisma.emailMessage.findUnique({
    where: { id },
    select: { attempts: true },
  });
  const giveUp = (row?.attempts ?? MAX_ATTEMPTS) >= MAX_ATTEMPTS;

  await prisma.emailMessage.update({
    where: { id },
    data: {
      status: giveUp ? "failed" : "queued",
      claimedAt: null,
      lastError: error.slice(0, 500),
      scheduledFor: giveUp
        ? undefined
        : new Date(Date.now() + RETRY_DELAY_MS),
    },
  });

  if (giveUp) await closeCampaignIfDone(id);
}

/**
 * מסמנת קמפיין כגמור כשלא נשארה בו שורה ממתינה.
 *
 * ⚠️ נגזר מהתור ולא ממונה: מונה שנשמר בשדה יכול לסתור את התור, וזו
 * בדיוק הסיבה ש-`EmailCampaign` מחזיק רק את `totalCount`.
 */
async function closeCampaignIfDone(messageId: string): Promise<void> {
  const row = await prisma.emailMessage.findUnique({
    where: { id: messageId },
    select: { campaignId: true },
  });
  if (!row) return;

  const pending = await prisma.emailMessage.count({
    where: {
      campaignId: row.campaignId,
      status: { in: ["queued", "sending"] },
    },
  });
  if (pending > 0) return;

  await prisma.emailCampaign.updateMany({
    where: { id: row.campaignId, status: "sending" },
    data: { status: "done" },
  });
}

/** קריאת ההגדרות, לנוחות הניקוז. */
export { readMailerSettings };
```

- [ ] **Step 6: לוודא קומפילציה**

```bash
npm run typecheck
```

Expected: ללא שגיאות

- [ ] **Step 7: קומיט**

```bash
git add src/lib/domain/mailRate.ts tools/mailRate.test.mjs src/server/mailer/outbox.ts
git commit -m "תור הדיוור: הכנסה עם snapshot מרונדר, תביעה מותנית, ודיווח"
```

---

### Task 9: הניקוז והשעון

**Files:**
- Create: `src/server/mailer/drain.ts`
- Create: `src/app/api/email/cron/route.ts`
- Modify: `src/app/api/whatsapp/cron/route.ts` (הפונקציה `run`)

**Interfaces:**
- Consumes: `claimMail`, `reportMail`, `readMailerSettings` (משימה 8); `sendMail`, `mailerConfigured` (משימה 6); `renderMail` (משימה 5); `signUnsubscribe` (משימה 4)
- Produces: `drainMailOutbox(origin: string): Promise<{ sent: number; failed: number; skipped: "notConfigured" | "paused" | null }>`

- [ ] **Step 1: לממש את הניקוז**

`src/server/mailer/drain.ts`:

```ts
import "server-only";

import { renderMail } from "@/lib/domain/mailTemplate";
import { signUnsubscribe } from "@/lib/unsubscribeToken";
import { mailerConfigured, sendMail } from "./provider";
import { claimMail, readMailerSettings, reportMail } from "./outbox";
import { prisma } from "@/server/db/client";

/**
 * ניקוז תור הדיוור.
 *
 * ⚠️ **קישור ההסרה נחתם כאן ולא בהכנסה לתור.** הוא נגזר מהכתובת
 * ומהסוד בלבד ולכן יוצא זהה בכל מקרה — אבל שמירתו בשורה הייתה
 * מקפיאה גם את שם המארח, ודיוור שנשלח לפני מעבר דומיין היה מפנה
 * לכתובת שכבר לא עונה.
 */

export interface MailDrainResult {
  sent: number;
  failed: number;
  skipped: "notConfigured" | "paused" | null;
}

function unsubscribeUrl(origin: string, email: string, secret: string): string {
  return `${origin}/unsubscribe/${signUnsubscribe(email, secret)}`;
}

export async function drainMailOutbox(
  origin: string,
): Promise<MailDrainResult> {
  if (!mailerConfigured()) {
    return { sent: 0, failed: 0, skipped: "notConfigured" };
  }

  const secret = process.env.MAILER_SECRET?.trim();
  if (!secret) {
    // ⚠️ בלי הסוד אין קישור הסרה, ובלי קישור הסרה אסור לשלוח —
    // זו חובה חוקית ולא תוספת. עצירה שקטה עדיפה על דיוור אסור.
    return { sent: 0, failed: 0, skipped: "notConfigured" };
  }

  const settings = await readMailerSettings();
  if (settings.paused) return { sent: 0, failed: 0, skipped: "paused" };

  const claimed = await claimMail(settings);

  let sent = 0;
  let failed = 0;

  for (const msg of claimed) {
    /*
     * ⚠️ **בדיקת ההסרה שוב, ברגע השליחה.** היא כבר נעשתה בהעלאה,
     * אבל בין ההעלאה לשליחה עוברות שעות: מי שלחץ "הסר" אחרי המייל
     * הראשון של הדיוור לא אמור לקבל את השאר.
     */
    const optedOut = await prisma.emailOptOut.findUnique({
      where: { email: msg.toEmail },
      select: { email: true },
    });
    if (optedOut) {
      await prisma.emailMessage.update({
        where: { id: msg.id },
        data: { status: "cancelled", claimedAt: null },
      });
      continue;
    }

    try {
      const { html, text } = renderMail({
        subject: msg.subject,
        body: msg.body,
        unsubscribeUrl: unsubscribeUrl(origin, msg.toEmail, secret),
      });

      await sendMail({
        to: msg.toEmail,
        subject: msg.subject,
        html,
        text,
        unsubscribeUrl: unsubscribeUrl(origin, msg.toEmail, secret),
      });

      await reportMail(msg.id, null);
      sent++;
    } catch (error) {
      await reportMail(
        msg.id,
        error instanceof Error ? error.message : String(error),
      );
      failed++;
    }
  }

  return { sent, failed, skipped: null };
}
```

- [ ] **Step 2: להוסיף את נתיב ה-cron**

`src/app/api/email/cron/route.ts`:

```ts
import { NextResponse } from "next/server";
import { drainMailOutbox } from "@/server/mailer/drain";

/**
 * ניקוז ידני של תור הדיוור.
 *
 * ⚠️ **זה אינו השעון.** השעון האמיתי הוא `pg_cron` שדופק את
 * `/api/whatsapp/cron` כל שתי דקות, והניקוז הזה נתלה עליו שם.
 * מתזמן שני היה מעיר את הפונקציה בנפרד ושורף ממכסת
 * `Fluid Active CPU` של חשבון Hobby — ארבע שעות לחודש בסך הכול.
 *
 * הנתיב קיים כדי שאפשר יהיה לדחוף ניקוז ידנית כשבודקים, ומאומת
 * באותו `CRON_SECRET`.
 */

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function run(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return NextResponse.json(
      { success: false, error: "אימות נכשל" },
      { status: 401 },
    );
  }

  const result = await drainMailOutbox(new URL(request.url).origin);
  return NextResponse.json({ success: true, ...result });
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
```

- [ ] **Step 3: לתלות את הניקוז על התקתוק הקיים**

ב-`src/app/api/whatsapp/cron/route.ts`, בתוך `run`, להחליף את שתי השורות האחרונות:

```ts
  const result = await drainOutbox(new URL(request.url).origin);

  /*
   * ⚠️ **תור הדיוור נתלה על התקתוק הזה ואין לו מתזמן משלו.** מתזמן
   * שני היה מעיר את הפונקציה בנפרד ושורף ממכסת `Fluid Active CPU`
   * של Hobby, שהיא ארבע שעות לחודש.
   *
   * ⚠️ **ה-catch אינו עצלנות.** תקלה בדיוור — סיסמת אפליקציה שפגה,
   * Gmail שחוסם — אסור לה לעצור את תזכורות החזרה, שהן מה שהמוקד
   * עובד לפיו. הדיוור נכשל בשקט וממשיך בתקתוק הבא; התזכורות לא.
   */
  const { drainMailOutbox } = await import("@/server/mailer/drain");
  const mail = await drainMailOutbox(new URL(request.url).origin).catch(
    (error: unknown) => ({
      sent: 0,
      failed: 0,
      skipped: null,
      error: error instanceof Error ? error.message : String(error),
    }),
  );

  return NextResponse.json({ success: true, ...result, mail });
```

- [ ] **Step 4: לוודא קומפילציה ובדיקות**

```bash
npm run typecheck && npm test
```

Expected: ללא שגיאות, `fail 0` — כל הבדיקות ירוקות

- [ ] **Step 5: קומיט**

```bash
git add src/server/mailer/drain.ts src/app/api/email/cron/route.ts src/app/api/whatsapp/cron/route.ts
git commit -m "ניקוז הדיוור, תלוי על התקתוק הקיים ובלי להפיל את התזכורות"
```

---

### Task 10: מסך ההסרה מרשימת התפוצה

**Files:**
- Create: `src/app/unsubscribe/[token]/page.tsx`
- Create: `src/app/api/email/unsubscribe/route.ts`
- Modify: `src/proxy.ts` (`PUBLIC_PREFIXES`, שורה 39 ואילך)

**Interfaces:**
- Consumes: `verifyUnsubscribe` (משימה 4), `prisma`
- Produces: המסלול `/unsubscribe/<token>` פתוח לכל, ו-`POST /api/email/unsubscribe` לכפתור המובנה של ג'ימייל

- [ ] **Step 1: לפתוח את שני הנתיבים בשער הגישה**

ב-`src/proxy.ts`, בתוך `PUBLIC_PREFIXES`, אחרי `"/lp"`:

```ts
  /*
   * ⚠️ **ההסרה מרשימת התפוצה חייבת להיות פתוחה לגמרי.** מי שמגיע
   * אליה הוא נמען של דיוור: אין לו חשבון, אין לו עוגייה, ולרוב אין
   * לו שום קשר למערכת. כל דבר שאינו 200 הוא מבחינתו סירוב להסיר
   * אותו — וזו בדיוק החובה שהחוק מטיל.
   *
   * הנתיב אינו מוביל לשום מקום: הוא קורא טוקן חתום וכותב שורה אחת.
   */
  "/unsubscribe",
  "/api/email/unsubscribe",
```

- [ ] **Step 2: לכתוב את נתיב ה-POST**

`src/app/api/email/unsubscribe/route.ts`:

```ts
import { NextResponse } from "next/server";

import { verifyUnsubscribe } from "@/lib/unsubscribeToken";
import { prisma } from "@/server/db/client";

/**
 * הכפתור המובנה של ג'ימייל (`List-Unsubscribe-Post`) שולח POST לכאן.
 *
 * ⚠️ **בלי הנתיב הזה הכותרת `List-Unsubscribe-Post` היא שקר**: היא
 * מבטיחה הסרה בלחיצה, ג'ימייל שולח POST ומקבל 405, והמשתמש רואה
 * שההסרה נכשלה. מי שקורה לו את זה מסמן "דווח כספאם" — וזה בדיוק
 * מה שהכותרת נועדה למנוע.
 */

/** רושם את ההסרה. מחזיר `false` אם הטוקן אינו תקף. */
export async function optOutByToken(
  token: string,
  reason: string,
): Promise<string | null> {
  const secret = process.env.MAILER_SECRET?.trim();
  if (!secret) return null;

  const email = verifyUnsubscribe(token, secret);
  if (!email) return null;

  await prisma.emailOptOut.upsert({
    where: { email },
    create: { email, reason },
    update: {},
  });

  return email;
}

export async function POST(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const email = await optOutByToken(token, "כפתור ההסרה של ספק הדואר");

  // ⚠️ 200 גם על טוקן פגום. ג'ימייל אינו מציג את התשובה לאיש,
  // ותשובת שגיאה רק תגרום לו לסמן את השולח כבעייתי.
  return NextResponse.json({ success: Boolean(email) }, { status: 200 });
}
```

- [ ] **Step 3: להצמיד את הפרמטר לכותרת שנשלחת**

ב-`src/server/mailer/drain.ts`, `unsubscribeUrl` מייצר כתובת דף. הכותרת צריכה את נתיב ה-POST. להחליף את הפונקציה ואת שתי הקריאות:

```ts
function unsubscribeLinks(
  origin: string,
  email: string,
  secret: string,
): { page: string; oneClick: string } {
  const token = signUnsubscribe(email, secret);
  return {
    page: `${origin}/unsubscribe/${token}`,
    // ⚠️ הטוקן ב-query ולא בנתיב: `List-Unsubscribe-Post` מחייב
    // כתובת שמקבלת POST, ונתיב דינמי היה מייצר גם דף GET באותה
    // כתובת — שני דברים שונים תחת URL אחד.
    oneClick: `${origin}/api/email/unsubscribe?t=${encodeURIComponent(token)}`,
  };
}
```

ובלולאה:

```ts
      const links = unsubscribeLinks(origin, msg.toEmail, secret);

      const { html, text } = renderMail({
        subject: msg.subject,
        body: msg.body,
        unsubscribeUrl: links.page,
      });

      await sendMail({
        to: msg.toEmail,
        subject: msg.subject,
        html,
        text,
        unsubscribeUrl: links.oneClick,
      });
```

- [ ] **Step 4: לכתוב את הדף**

`src/app/unsubscribe/[token]/page.tsx`:

```tsx
import { optOutByToken } from "@/app/api/email/unsubscribe/route";

/**
 * דף ההסרה מרשימת התפוצה.
 *
 * ⚠️ **ההסרה מתבצעת בעצם הפתיחה, בלי כפתור אישור.** מסך ביניים הוא
 * חיכוך, וחיכוך בהסרה הוא בדיוק מה שגורם לאנשים ללחוץ "דווח כספאם"
 * במקום. אין כאן מה לאשר: הטוקן חתום, והפעולה הפיכה בפנייה אלינו.
 */

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const email = await optOutByToken(token, "קישור ההסרה במייל");

  return (
    <main
      dir="rtl"
      className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center"
    >
      {email ? (
        <>
          <h1 className="text-2xl font-semibold">הוסרת מרשימת התפוצה</h1>
          <p className="text-ink-2">
            לא נשלח יותר דיוור אל {email}. אם זו הייתה טעות, השב לאחד
            המיילים שקיבלת ונחזיר אותך.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold">הקישור אינו תקף</h1>
          <p className="text-ink-2">
            ייתכן שהוא נחתך בהעתקה. השב לאחד המיילים שקיבלת ונסיר אותך
            ידנית.
          </p>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 5: לוודא קומפילציה, ואז לבדוק את המסלול בדפדפן**

```bash
npm run typecheck
```

הרם את השרת דרך תצורת `datalink-crm` ב-`.claude/launch.json` (פורט 3000) — לא דרך Bash. ואז:

- פתח `/unsubscribe/זבל` → מצופה "הקישור אינו תקף", ללא 500
- הפק טוקן אמיתי והיכנס איתו:

```bash
node -e "process.env.MAILER_SECRET='x';import('./src/lib/unsubscribeToken.ts').then(m=>console.log(m.signUnsubscribe('test@example.com','x')))"
```

→ מצופה "הוסרת מרשימת התפוצה", ושורה חדשה ב-`EmailOptOut`.

- [ ] **Step 6: קומיט**

```bash
git add src/app/unsubscribe src/app/api/email/unsubscribe src/proxy.ts src/server/mailer/drain.ts
git commit -m "הסרה מרשימת התפוצה: דף פתוח, כפתור בלחיצה אחת, בלי מסך ביניים"
```

---

### Task 11: זיהוי עמודות בקובץ הנמענים

**Files:**
- Create: `src/components/mailer/recipientColumns.ts`
- Test: `tools/recipientColumns.test.mjs`

**Interfaces:**
- Consumes: `normalizeEmail` (משימה 2)
- Produces:
  - `interface RecipientMapping { emailAt: number; nameAt: number | null }`
  - `interface DetectedRecipients { mapping: RecipientMapping | null; hadHeader: boolean; headers: string[] }`
  - `detectRecipientColumns(matrix: string[][]): DetectedRecipients`
  - `buildRecipients(matrix, detected): { email: string; name: string; fields: Record<string, string> }[]`

- [ ] **Step 1: לכתוב את הבדיקה הנכשלת**

`tools/recipientColumns.test.mjs`:

```js
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildRecipients,
  detectRecipientColumns,
} from "../src/components/mailer/recipientColumns.ts";

test("עמודות: כותרת בעברית מזוהה", () => {
  const matrix = [
    ["שם מלא", "אימייל", "עיר"],
    ["דנה כהן", "dana@gmail.com", "חיפה"],
  ];
  const d = detectRecipientColumns(matrix);
  assert.equal(d.hadHeader, true);
  assert.deepEqual(d.mapping, { emailAt: 1, nameAt: 0 });
  assert.deepEqual(d.headers, ["שם מלא", "אימייל", "עיר"]);
});

test("עמודות: כותרת באנגלית מזוהה", () => {
  const d = detectRecipientColumns([
    ["Name", "E-mail"],
    ["Dana", "dana@gmail.com"],
  ]);
  assert.deepEqual(d.mapping, { emailAt: 1, nameAt: 0 });
});

test("עמודות: בלי כותרת — מזוהה לפי תוכן", () => {
  // ⚠️ קובץ בלי שורת כותרת הוא המקרה הנפוץ בייצוא ממערכות ישנות.
  // זיהוי לפי תוכן מונע מהשורה הראשונה להיבלע כאילו הייתה כותרת.
  const d = detectRecipientColumns([
    ["דנה כהן", "dana@gmail.com"],
    ["יוסי לוי", "yossi@gmail.com"],
  ]);
  assert.equal(d.hadHeader, false);
  assert.deepEqual(d.mapping, { emailAt: 1, nameAt: 0 });
});

test("עמודות: קובץ בלי עמודת מייל מוחזר בלי מיפוי", () => {
  const d = detectRecipientColumns([
    ["שם", "טלפון"],
    ["דנה", "0501234567"],
  ]);
  assert.equal(d.mapping, null);
});

test("עמודות: קובץ ריק אינו מפיל", () => {
  assert.equal(detectRecipientColumns([]).mapping, null);
  assert.equal(detectRecipientColumns([[]]).mapping, null);
});

test("נמענים: שאר העמודות הופכות לשדות מיזוג לפי הכותרת", () => {
  const matrix = [
    ["שם מלא", "אימייל", "עיר"],
    ["דנה כהן", "dana@gmail.com", "חיפה"],
  ];
  const rows = buildRecipients(matrix, detectRecipientColumns(matrix));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].email, "dana@gmail.com");
  assert.equal(rows[0].name, "דנה כהן");
  assert.equal(rows[0].fields["עיר"], "חיפה");
});

test("נמענים: בלי כותרת השדות מקבלים שם לפי מיקום", () => {
  const matrix = [["דנה", "dana@gmail.com", "חיפה"]];
  const rows = buildRecipients(matrix, detectRecipientColumns(matrix));
  assert.equal(rows[0].fields["עמודה 3"], "חיפה");
});

test("נמענים: שורה בלי מייל נשמרת ומסומנת, ולא נעלמת", () => {
  // ⚠️ השמטה שקטה היא איך שנמענים "נעלמים" בלי שאיש ידע.
  // המסך סופר אותן — ולכן הן חייבות לחזור מכאן.
  const matrix = [
    ["שם", "אימייל"],
    ["דנה", "dana@gmail.com"],
    ["יוסי", "לא כתובת"],
    ["", ""],
  ];
  const rows = buildRecipients(matrix, detectRecipientColumns(matrix));
  assert.equal(rows.length, 2);
  assert.equal(rows[1].email, "");
  assert.equal(rows[1].name, "יוסי");
});
```

- [ ] **Step 2: להריץ ולוודא כישלון**

```bash
npx tsx --test tools/recipientColumns.test.mjs
```

Expected: FAIL — `Cannot find module`

- [ ] **Step 3: לממש**

`src/components/mailer/recipientColumns.ts`:

```ts
import { normalizeEmail } from "@/lib/email";

/**
 * זיהוי העמודות בקובץ הנמענים.
 *
 * מקביל ל-`src/components/leads/importColumns.ts` אבל מכוון למייל:
 * שם המקבל ושדות מיזוג חופשיים, בלי טלפון ובלי מודל הלידים.
 *
 * ⚠️ **הזיהוי הוא הצעה שהמשתמש מאשר או משנה במסך**, ולא החלטה
 * סופית. קובץ עם שתי עמודות מייל אינו תקלה שצריך לפתור כאן.
 */

const EMAIL_HEADERS = ["מייל", "אימייל", "דואר", 'דוא"ל', "email", "e-mail", "mail"];
const NAME_HEADERS = ["שם", "שם מלא", "לקוח", "name", "full name", "customer"];

export interface RecipientMapping {
  emailAt: number;
  nameAt: number | null;
}

export interface DetectedRecipients {
  mapping: RecipientMapping | null;
  hadHeader: boolean;
  /** שמות העמודות — מהכותרת, או "עמודה N" כשאין */
  headers: string[];
}

function matches(cell: string, options: string[]): boolean {
  const value = cell.trim().toLowerCase();
  return value.length > 0 && options.some((o) => value.includes(o));
}

/** האם השורה נראית כמו כותרת — כלומר אין בה אף כתובת מייל תקינה. */
function looksLikeHeader(row: string[]): boolean {
  return row.some((c) => c.trim().length > 0) && !row.some((c) => normalizeEmail(c));
}

export function detectRecipientColumns(
  matrix: string[][],
): DetectedRecipients {
  const rows = matrix.filter((r) => r.some((c) => c.trim().length > 0));
  if (rows.length === 0) return { mapping: null, hadHeader: false, headers: [] };

  const hadHeader = looksLikeHeader(rows[0]);
  const width = Math.max(...rows.map((r) => r.length));

  const headers = Array.from({ length: width }, (_, i) =>
    hadHeader ? (rows[0][i] ?? "").trim() || `עמודה ${i + 1}` : `עמודה ${i + 1}`,
  );

  const body = hadHeader ? rows.slice(1) : rows;

  let emailAt = hadHeader
    ? rows[0].findIndex((c) => matches(c, EMAIL_HEADERS))
    : -1;

  // ⚠️ נפילה לזיהוי לפי תוכן: העמודה שהכי הרבה תאים בה הם כתובת.
  // כותרת שכתובה בשפה שלא חשבנו עליה לא אמורה להפיל את הייבוא.
  if (emailAt < 0) {
    let best = -1;
    let bestCount = 0;
    for (let col = 0; col < width; col++) {
      const count = body.filter((r) => normalizeEmail(r[col] ?? "")).length;
      if (count > bestCount) {
        bestCount = count;
        best = col;
      }
    }
    emailAt = bestCount > 0 ? best : -1;
  }

  if (emailAt < 0) return { mapping: null, hadHeader, headers };

  let nameAt = hadHeader
    ? rows[0].findIndex((c, i) => i !== emailAt && matches(c, NAME_HEADERS))
    : -1;

  // בלי כותרת: העמודה הראשונה שאינה המייל ואינה ריקה
  if (nameAt < 0) {
    nameAt = headers.findIndex(
      (_, i) => i !== emailAt && body.some((r) => (r[i] ?? "").trim().length > 0),
    );
  }

  return {
    mapping: { emailAt, nameAt: nameAt >= 0 ? nameAt : null },
    hadHeader,
    headers,
  };
}

export interface ParsedRecipient {
  /** מנורמל, או מחרוזת ריקה אם התא אינו כתובת תקינה */
  email: string;
  name: string;
  fields: Record<string, string>;
}

/**
 * ⚠️ **שורה בלי מייל תקין חוזרת עם `email` ריק ואינה מושמטת.** השמטה
 * שקטה כאן היא בדיוק איך שנמענים "נעלמים" בלי שאיש ידע; מסך האישור
 * סופר אותן ומציג את הרשימה לפני השליחה.
 *
 * שורה ריקה לגמרי כן מושמטת — היא רעש של אקסל, לא נמען.
 */
export function buildRecipients(
  matrix: string[][],
  detected: DetectedRecipients,
): ParsedRecipient[] {
  const { mapping, hadHeader, headers } = detected;
  if (!mapping) return [];

  const rows = matrix.filter((r) => r.some((c) => c.trim().length > 0));
  const body = hadHeader ? rows.slice(1) : rows;

  return body.map((row) => {
    const fields: Record<string, string> = {};
    headers.forEach((header, i) => {
      if (i === mapping.emailAt || i === mapping.nameAt) return;
      const value = (row[i] ?? "").trim();
      if (value) fields[header] = value;
    });

    return {
      email: normalizeEmail(row[mapping.emailAt] ?? "") ?? "",
      name:
        mapping.nameAt === null ? "" : (row[mapping.nameAt] ?? "").trim(),
      fields,
    };
  });
}
```

- [ ] **Step 4: להריץ ולוודא הצלחה**

```bash
npx tsx --test tools/recipientColumns.test.mjs
```

Expected: PASS — 8 בדיקות

- [ ] **Step 5: קומיט**

```bash
git add src/components/mailer/recipientColumns.ts tools/recipientColumns.test.mjs
git commit -m "זיהוי עמודות בקובץ הנמענים, ושורה בלי מייל שנספרת ולא נעלמת"
```

---

### Task 12: המסך — העלאה, כתיבה, אישור, שליחה

**Files:**
- Create: `src/app/(app)/mailer/page.tsx`
- Create: `src/components/mailer/MailerClient.tsx`
- Create: `src/app/api/email/campaign/route.ts`
- Modify: `src/lib/domain/permissions.ts` (`ROUTE_ROLES`)
- Modify: `src/components/shell/nav.ts` (`IconName`, `NAV`)
- Modify: `src/components/ui/Icon.tsx` (אייקון `mailer`)

**Interfaces:**
- Consumes: `readXlsxSheet` מ-`@/lib/xlsx`; `parseDelimited`, `decodeSpreadsheetText` מ-`@/lib/csv`; `detectRecipientColumns`, `buildRecipients` (משימה 11); `mergeFieldsIn`, `renderMerge`, `emptyFieldsIn` (משימה 3); `enqueueCampaign` (משימה 8); `mailerConfigured` (משימה 6); `requireRouteAccess` מ-`@/server/auth/session`
- Produces: המסלול `/mailer`, ו-`POST /api/email/campaign` שמקבל `{ name, subjectTemplate, bodyTemplate, recipients }` ומחזיר `EnqueueResult`

- [ ] **Step 1: לרשום את ההרשאה**

ב-`src/lib/domain/permissions.ts`, בתוך `ROUTE_ROLES`:

```ts
  "/mailer": ["owner", "manager"],
```

⚠️ אין להוסיף שדה `roles` ל-`nav.ts` ואין קבוע `ALLOWED` ב-`page.tsx`. ההערה שמעל `ROUTE_ROLES` מסבירה איזו דליפה נפערה בדיוק כך.

- [ ] **Step 2: להוסיף אייקון ופריט ניווט**

ב-`src/components/ui/Icon.tsx`, במפת האייקונים, ערך `mailer` (מעטפה):

```tsx
  mailer: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
```

ב-`src/components/shell/nav.ts`, להוסיף `"mailer"` ל-`IconName`, ופריט בקבוצה שבה יושבים `/bots` ו-`/renewals`:

```ts
      {
        href: "/mailer",
        label: "דיוור",
        hint: "שליחת מייל לרשימה מקובץ",
        icon: "mailer",
      },
```

- [ ] **Step 3: לכתוב את נתיב היצירה**

`src/app/api/email/campaign/route.ts`:

```ts
import { NextResponse } from "next/server";

import { requireRouteAccess } from "@/server/auth/session";
import { enqueueCampaign, type RecipientInput } from "@/server/mailer/outbox";
import { mailerConfigured } from "@/server/mailer/provider";

/** תקרת נמענים לבקשה — מגן על גוף בקשה שמנפח את הפונקציה. */
const MAX_RECIPIENTS = 5_000;

export async function POST(request: Request): Promise<Response> {
  const user = await requireRouteAccess("/mailer");

  if (!mailerConfigured() || !process.env.MAILER_SECRET?.trim()) {
    return NextResponse.json(
      {
        success: false,
        error: "השליחה אינה מוגדרת — חסרים GMAIL_USER, GMAIL_APP_PASSWORD או MAILER_SECRET",
      },
      { status: 400 },
    );
  }

  const body = (await request.json()) as {
    name?: string;
    subjectTemplate?: string;
    bodyTemplate?: string;
    recipients?: RecipientInput[];
  };

  const name = body.name?.trim();
  const subjectTemplate = body.subjectTemplate?.trim();
  const bodyTemplate = body.bodyTemplate?.trim();
  const recipients = body.recipients ?? [];

  if (!name || !subjectTemplate || !bodyTemplate) {
    return NextResponse.json(
      { success: false, error: "שם הדיוור, הנושא והתוכן הם שדות חובה" },
      { status: 400 },
    );
  }
  if (recipients.length === 0) {
    return NextResponse.json(
      { success: false, error: "אין נמענים" },
      { status: 400 },
    );
  }
  if (recipients.length > MAX_RECIPIENTS) {
    return NextResponse.json(
      { success: false, error: `יותר מ-${MAX_RECIPIENTS} נמענים בבקשה אחת` },
      { status: 400 },
    );
  }

  const result = await enqueueCampaign({
    name,
    subjectTemplate,
    bodyTemplate,
    createdById: user.id,
    recipients,
  });

  return NextResponse.json({ success: true, ...result });
}
```

- [ ] **Step 4: לכתוב את המסך**

`src/app/(app)/mailer/page.tsx`:

```tsx
import { requireRouteAccess } from "@/server/auth/session";
import { mailerConfigured, mailerSenderAddress } from "@/server/mailer/provider";
import { MailerClient } from "@/components/mailer/MailerClient";

/**
 * מסך הדיוור.
 *
 * ⚠️ מצב ההגדרה נבדק בשרת ומועבר למטה. בלי זה המשתמש מעלה קובץ,
 * כותב טקסט, לוחץ שלח — ומגלה רק אז שאין דרך לשלוח.
 */
export default async function MailerPage() {
  await requireRouteAccess("/mailer");

  return (
    <MailerClient
      configured={mailerConfigured() && Boolean(process.env.MAILER_SECRET?.trim())}
      sender={mailerSenderAddress()}
    />
  );
}
```

`src/components/mailer/MailerClient.tsx` — רכיב `"use client"` עם ארבעה שלבים במצב אחד (`step: "upload" | "write" | "confirm" | "done"`):

```tsx
"use client";

import { useMemo, useState } from "react";

import { parseDelimited, decodeSpreadsheetText } from "@/lib/csv";
import { readXlsxSheet } from "@/lib/xlsx";
import {
  buildRecipients,
  detectRecipientColumns,
  type DetectedRecipients,
  type ParsedRecipient,
} from "./recipientColumns";
import { emptyFieldsIn, mergeFieldsIn, renderMerge } from "@/lib/domain/mailMerge";

interface EnqueueResult {
  campaignId: string;
  queued: number;
  invalid: number;
  duplicate: number;
  optedOut: number;
}

export function MailerClient({
  configured,
  sender,
}: {
  configured: boolean;
  sender: string | null;
}) {
  const [step, setStep] = useState<"upload" | "write" | "confirm" | "done">("upload");
  const [detected, setDetected] = useState<DetectedRecipients | null>(null);
  const [rows, setRows] = useState<ParsedRecipient[]>([]);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("שלום {{שם}},\n\n");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EnqueueResult | null>(null);

  /** ⚠️ הקובץ נקרא בדפדפן ולא נשלח לשרת — רק הרשימה המפוענחת נשלחת. */
  async function onFile(file: File) {
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const matrix = file.name.toLowerCase().endsWith(".xlsx")
        ? await readXlsxSheet(buffer)
        : parseDelimited(decodeSpreadsheetText(buffer));

      const d = detectRecipientColumns(matrix);
      if (!d.mapping) {
        setError("לא נמצאה עמודת מייל בקובץ");
        return;
      }
      setDetected(d);
      setRows(buildRecipients(matrix, d));
      setStep("write");
    } catch {
      setError("לא הצלחנו לקרוא את הקובץ. שמור אותו כ-CSV או XLSX ונסה שוב.");
    }
  }

  const valid = useMemo(() => rows.filter((r) => r.email.length > 0), [rows]);
  const invalid = rows.length - valid.length;

  const duplicate = useMemo(() => {
    const seen = new Set<string>();
    return valid.filter((r) => (seen.has(r.email) ? true : (seen.add(r.email), false)))
      .length;
  }, [valid]);

  /** כמה נמענים ייצאו עם שדה מיזוג ריק — הסיבה שהספירה הזו קיימת. */
  const withEmptyField = useMemo(
    () =>
      valid.filter(
        (r) =>
          emptyFieldsIn(`${subject}\n${body}`, { ...r.fields, שם: r.name }).length > 0,
      ).length,
    [valid, subject, body],
  );

  const preview = useMemo(() => {
    const first = valid[0];
    if (!first) return { subject: "", body: "" };
    const values = { ...first.fields, שם: first.name };
    return {
      subject: renderMerge(subject, values),
      body: renderMerge(body, values),
    };
  }, [valid, subject, body]);

  const fields = useMemo(
    () => (detected ? ["שם", ...detected.headers] : ["שם"]),
    [detected],
  );

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/email/campaign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          subjectTemplate: subject,
          bodyTemplate: body,
          recipients: valid.map((r) => ({
            email: r.email,
            name: r.name,
            fields: r.fields,
          })),
        }),
      });
      const json = await response.json();
      if (!json.success) {
        setError(json.error ?? "השליחה נכשלה");
        return;
      }
      setResult(json as EnqueueResult);
      setStep("done");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main dir="rtl" className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">דיוור במייל</h1>

      {!configured && (
        <p className="rounded-lg border border-warn/40 bg-warn/8 p-4 text-sm">
          השליחה אינה מוגדרת. חסרים <code>GMAIL_USER</code>,{" "}
          <code>GMAIL_APP_PASSWORD</code> או <code>MAILER_SECRET</code> — ראה{" "}
          <code>.env.example</code>. אפשר להכין דיוור, אבל הוא לא ייצא.
        </p>
      )}
      {configured && sender && (
        <p className="text-sm text-ink-2">המיילים ייצאו מהכתובת {sender}</p>
      )}

      {error && (
        <p className="rounded-lg border border-danger/40 bg-danger/8 p-4 text-sm">
          {error}
        </p>
      )}

      {step === "upload" && (
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-line p-10 text-center">
          <span className="font-medium">בחר קובץ נמענים</span>
          <span className="text-sm text-ink-2">Excel (.xlsx) או CSV</span>
          <input
            type="file"
            accept=".xlsx,.csv,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFile(file);
            }}
          />
        </label>
      )}

      {step === "write" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-2">
            {valid.length} נמענים תקינים מתוך {rows.length} שורות
          </p>

          <input
            className="rounded-lg border border-line bg-surface-2 p-3"
            placeholder="שם הדיוור (פנימי)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="rounded-lg border border-line bg-surface-2 p-3"
            placeholder="נושא המייל"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <textarea
            className="min-h-48 rounded-lg border border-line bg-surface-2 p-3"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />

          <p className="text-sm text-ink-2">
            שדות זמינים:{" "}
            {fields.map((f) => (
              <button
                key={f}
                type="button"
                className="mx-1 rounded bg-brand/8 px-2 py-0.5"
                onClick={() => setBody((b) => `${b}{{${f}}}`)}
              >
                {`{{${f}}}`}
              </button>
            ))}
          </p>

          <div className="rounded-lg border border-line p-4">
            <p className="mb-2 text-xs text-ink-2">
              תצוגה מקדימה — {valid[0]?.email ?? "אין נמענים"}
            </p>
            <p className="font-medium">{preview.subject}</p>
            <p className="whitespace-pre-wrap text-sm">{preview.body}</p>
          </div>

          <button
            type="button"
            className="rounded-lg bg-brand p-3 font-medium disabled:opacity-50"
            disabled={!name.trim() || !subject.trim() || !body.trim() || valid.length === 0}
            onClick={() => setStep("confirm")}
          >
            המשך לאישור
          </button>
        </div>
      )}

      {step === "confirm" && (
        <div className="flex flex-col gap-4">
          <ul className="rounded-lg border border-line p-4 text-sm">
            <li>נמענים שיקבלו: <strong>{valid.length - duplicate}</strong></li>
            <li>כתובות פסולות שידולגו: {invalid}</li>
            <li>כפילויות שיאוחדו: {duplicate}</li>
            {withEmptyField > 0 && (
              <li className="text-warn">
                ⚠️ {withEmptyField} נמענים עם שדה מיזוג ריק — הטקסט אצלם ייצא חסר
              </li>
            )}
          </ul>
          <p className="text-sm text-ink-2">
            מי שהסיר את עצמו בעבר ידולג אוטומטית, והספירה הסופית תוצג אחרי השליחה.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg bg-brand p-3 font-medium disabled:opacity-50"
              disabled={busy || !configured}
              onClick={() => void send()}
            >
              {busy ? "מכניס לתור…" : `שלח ל-${valid.length - duplicate} נמענים`}
            </button>
            <button
              type="button"
              className="rounded-lg border border-line p-3"
              onClick={() => setStep("write")}
            >
              חזרה
            </button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="flex flex-col gap-3 rounded-lg border border-line p-4">
          <p className="font-medium">{result.queued} מיילים נכנסו לתור</p>
          <ul className="text-sm text-ink-2">
            <li>כתובות פסולות: {result.invalid}</li>
            <li>כפילויות: {result.duplicate}</li>
            <li>מוסרים מרשימת התפוצה: {result.optedOut}</li>
          </ul>
          <p className="text-sm text-ink-2">
            השליחה מתפרסת לפי חלון השליחה והתקרה היומית ואינה יוצאת בבת אחת.
          </p>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 5: לוודא קומפילציה ובדיקות**

```bash
npm run typecheck && npm run lint && npm test
```

Expected: ללא שגיאות, `fail 0` — כל הבדיקות ירוקות

- [ ] **Step 6: לבדוק במסך**

הרם את השרת דרך תצורת `datalink-crm` ב-`.claude/launch.json`, ואז:

- `/mailer` בתור owner → המסך עולה, עם רצועת האזהרה אם `.env` ריק
- העלה קובץ CSV בן שלוש שורות עם כותרת `שם,אימייל,עיר`, אחת מהן עם מייל פגום → מצופה "2 נמענים תקינים מתוך 3 שורות"
- הקלד `שלום {{שם}} מ{{עיר}}` → מצופה שהתצוגה המקדימה תציג את השורה הראשונה
- `/mailer` בתור עובד רגיל → מצופה הפניה, והפריט אינו מופיע בתפריט

- [ ] **Step 7: קומיט**

```bash
git add "src/app/(app)/mailer" src/components/mailer/MailerClient.tsx src/app/api/email/campaign src/lib/domain/permissions.ts src/components/shell/nav.ts src/components/ui/Icon.tsx
git commit -m "מסך הדיוור: העלאה, מיזוג, ומסך אישור שסופר לפני שהוא שולח"
```

---

### Task 13: מצב הדיוור ומתג ההשהיה

**Files:**
- Create: `src/server/mailer/overview.ts`
- Create: `src/components/mailer/CampaignList.tsx`
- Modify: `src/components/mailer/MailerClient.tsx` (הצגת הרשימה מעל האשף)
- Modify: `src/app/(app)/mailer/page.tsx` (העברת הנתונים)
- Create: `src/app/api/email/pause/route.ts`

**Interfaces:**
- Consumes: `prisma`, `readMailerSettings`, `writeMailerSettings` (משימה 7), `requireRouteAccess`
- Produces:
  - `mailerOverview(): Promise<{ paused: boolean; sentToday: number; dailyCap: number; campaigns: CampaignRow[] }>`
  - `interface CampaignRow { id, name, status, total, sent, failed, pending, createdAt }`

- [ ] **Step 1: לממש את הסקירה**

`src/server/mailer/overview.ts`:

```ts
import "server-only";

import { prisma } from "@/server/db/client";
import { readMailerSettings } from "./settings";
import { sentMailToday } from "./outbox";

/**
 * מצב הדיוור למסך.
 *
 * ⚠️ **המונים נספרים מהתור ולא נקראים משדה.** מונה שנשמר בקמפיין
 * יכול לסתור את התור — וכשהוא סותר, זה שקר שנראה כמו מידע.
 */

export interface CampaignRow {
  id: string;
  name: string;
  status: string;
  total: number;
  sent: number;
  failed: number;
  pending: number;
  createdAt: Date;
}

export interface MailerOverview {
  paused: boolean;
  pausedReason: string | null;
  sentToday: number;
  dailyCap: number;
  campaigns: CampaignRow[];
}

export async function mailerOverview(): Promise<MailerOverview> {
  const [settings, today, campaigns] = await Promise.all([
    readMailerSettings(),
    sentMailToday(),
    prisma.emailCampaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, name: true, status: true, totalCount: true, createdAt: true },
    }),
  ]);

  const counts = await prisma.emailMessage.groupBy({
    by: ["campaignId", "status"],
    where: { campaignId: { in: campaigns.map((c) => c.id) } },
    _count: { _all: true },
  });

  const rows: CampaignRow[] = campaigns.map((c) => {
    const mine = counts.filter((x) => x.campaignId === c.id);
    const of = (status: string) =>
      mine.find((x) => x.status === status)?._count._all ?? 0;

    return {
      id: c.id,
      name: c.name,
      status: c.status,
      total: c.totalCount,
      sent: of("sent"),
      failed: of("failed"),
      pending: of("queued") + of("sending"),
      createdAt: c.createdAt,
    };
  });

  return {
    paused: settings.paused,
    pausedReason: settings.pausedReason,
    sentToday: today,
    dailyCap: settings.dailyCap,
    campaigns: rows,
  };
}
```

- [ ] **Step 2: לממש את מתג ההשהיה**

`src/app/api/email/pause/route.ts`:

```ts
import { NextResponse } from "next/server";

import { requireRouteAccess } from "@/server/auth/session";
import { writeMailerSettings } from "@/server/mailer/settings";

/**
 * עצירת כל הדיוור, לחיצה אחת.
 *
 * ⚠️ עצירה ולא ביטול: התור נשמר וממשיך להתנקז כשמפעילים מחדש.
 * דיוור שנמחק בטעות אינו ניתן לשחזור, ודיוור שנעצר — כן.
 */
export async function POST(request: Request): Promise<Response> {
  const user = await requireRouteAccess("/mailer");
  const { paused } = (await request.json()) as { paused?: boolean };

  await writeMailerSettings(
    {
      paused: Boolean(paused),
      pausedReason: paused ? "נעצר מהמסך" : null,
      pausedAt: paused ? new Date() : null,
    },
    user.id,
  );

  return NextResponse.json({ success: true, paused: Boolean(paused) });
}
```

- [ ] **Step 3: להציג את הרשימה**

`src/components/mailer/CampaignList.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { MailerOverview } from "@/server/mailer/overview";

export function CampaignList({ overview }: { overview: MailerOverview }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function togglePause() {
    setBusy(true);
    try {
      await fetch("/api/email/pause", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paused: !overview.paused }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section dir="rtl" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-2">
          יצאו היום {overview.sentToday}
          {overview.dailyCap > 0 ? ` מתוך ${overview.dailyCap}` : ""}
        </p>
        <button
          type="button"
          className="rounded-lg border border-line px-3 py-1.5 text-sm disabled:opacity-50"
          disabled={busy}
          onClick={() => void togglePause()}
        >
          {overview.paused ? "הפעל שליחה" : "עצור שליחה"}
        </button>
      </div>

      {overview.paused && (
        <p className="rounded-lg border border-warn/40 bg-warn/8 p-3 text-sm">
          השליחה עצורה. התור נשמר וימשיך כשתפעיל אותה.
        </p>
      )}

      {overview.campaigns.length > 0 && (
        <table className="w-full text-right text-sm">
          <thead className="text-ink-2">
            <tr>
              <th className="p-2">דיוור</th>
              <th className="p-2 nums">נשלחו</th>
              <th className="p-2 nums">ממתינים</th>
              <th className="p-2 nums">נכשלו</th>
            </tr>
          </thead>
          <tbody>
            {overview.campaigns.map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="p-2">{c.name}</td>
                <td className="p-2 nums">
                  {c.sent}/{c.total}
                </td>
                <td className="p-2 nums">{c.pending}</td>
                <td className="p-2 nums">{c.failed || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
```

- [ ] **Step 4: לחבר למסך**

`src/app/(app)/mailer/page.tsx` במלואו:

```tsx
import { requireRouteAccess } from "@/server/auth/session";
import { mailerConfigured, mailerSenderAddress } from "@/server/mailer/provider";
import { mailerOverview } from "@/server/mailer/overview";
import { MailerClient } from "@/components/mailer/MailerClient";

/**
 * מסך הדיוור.
 *
 * ⚠️ מצב ההגדרה נבדק בשרת ומועבר למטה. בלי זה המשתמש מעלה קובץ,
 * כותב טקסט, לוחץ שלח — ומגלה רק אז שאין דרך לשלוח.
 */
export default async function MailerPage() {
  await requireRouteAccess("/mailer");

  const overview = await mailerOverview();

  return (
    <MailerClient
      configured={mailerConfigured() && Boolean(process.env.MAILER_SECRET?.trim())}
      sender={mailerSenderAddress()}
      overview={overview}
    />
  );
}
```

ב-`src/components/mailer/MailerClient.tsx`, שלושה שינויים:

```tsx
import { CampaignList } from "./CampaignList";
import type { MailerOverview } from "@/server/mailer/overview";
```

חתימת הרכיב:

```tsx
export function MailerClient({
  configured,
  sender,
  overview,
}: {
  configured: boolean;
  sender: string | null;
  overview: MailerOverview;
}) {
```

ומיד מתחת ל-`<h1>`:

```tsx
      <CampaignList overview={overview} />
```

- [ ] **Step 5: לוודא הכל**

```bash
npm run typecheck && npm run lint && npm test
```

Expected: ללא שגיאות, `fail 0` — כל הבדיקות ירוקות

בדפדפן: שלח דיוור קטן לכתובת שלך, ודא שהשורה מופיעה כ"ממתינים", דחוף ניקוז ידני:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/email/cron
```

→ מצופה שהמייל יגיע, שהשורה תעבור ל"נשלחו", ושהפוטר יכיל קישור הסרה עובד.

- [ ] **Step 6: קומיט**

```bash
git add src/server/mailer/overview.ts src/components/mailer src/app/api/email/pause "src/app/(app)/mailer"
git commit -m "מצב הדיוור: מונים מהתור, ומתג עצירה שלא מוחק כלום"
```

---

## סיכום כיסוי מול הספק

| דרישה בספק | משימה |
| --- | --- |
| מסך `/mailer`, ניווט, הרשאה למנהלים | 12 |
| `sendMail` מאחורי ממשק, Gmail SMTP, סיסמת אפליקציה | 6 |
| `EmailCampaign` / `EmailMessage` / `EmailOptOut` / `MailerSettings` | 1 |
| snapshot מרונדר, `dedupeKey` | 1, 8 |
| בדיקת הסרה פעמיים (העלאה + תביעה) | 8, 9 |
| קריאת קובץ בדפדפן, מיפוי עמודות | 11, 12 |
| מסך אישור עם מונים | 12 |
| ניקוז, תביעה בטוחה להרצה כפולה | 8, 9 |
| בלי job חדש ב-`pg_cron` | 9 |
| חלון שליחה, תקרה יומית, קצב לתקתוק | 7, 8 |
| קישור הסרה + `List-Unsubscribe` | 4, 6, 9, 10 |
| עטיפת HTML RTL + גרסת טקסט | 5 |
| בדיקות: מיזוג, נרמול, dedupe, HMAC, תקרה | 2, 3, 4, 5, 8, 11 |
