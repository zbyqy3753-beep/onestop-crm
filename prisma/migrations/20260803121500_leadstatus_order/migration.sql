-- תיקון סדר הערכים של LeadStatus.
--
-- ⚠️ הקוד מסתמך על כך שסדר הערכים כאן זהה ל-STATUS_ORDER ב-types.ts:
-- Postgres ממיין enum לפי סדר היצירה, ומסך הלידים ממיין עם
-- `orderBy: { status: dir }` בלי מיפוי נוסף (ראה ההערה בראש
-- src/server/repositories/prisma/leads.ts).
--
-- שלושה ערכים שנוספו בעבר — existingCustomer, noAnswer1, noAnswer2 —
-- נוספו עם `ADD VALUE` רגיל, שמצרף תמיד לסוף. בקוד הם יושבים באמצע,
-- ולכן מיון לפי סטטוס בטבלה כבר החזיר סדר שגוי עבורם: "לקוח קיים"
-- ו"אין מענה 1/2" נפלו אחרי "הפסד" במקום במקומם.
--
-- ב-Postgres אי אפשר להזיז ערך קיים, ולכן הטיפוס נבנה מחדש בסדר הנכון
-- והעמודות מומרות אליו. ההמרה דרך ::text בטוחה — שמות הערכים לא
-- משתנים, רק הסדר הפנימי שלהם.

ALTER TYPE "LeadStatus" RENAME TO "LeadStatus_old";

CREATE TYPE "LeadStatus" AS ENUM (
  'new',
  'recycled',
  'inProgress',
  'contacted',
  'quoteSent',
  'awaitingClient',
  'followUp',
  'futureTracking',
  'won',
  'notRelevant',
  'notInterested',
  'existingCustomer',
  'noAnswer',
  'noAnswer1',
  'noAnswer2',
  'returning',
  'soldByCompetitor',
  'denies',
  'lost'
);

ALTER TABLE "Lead" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Lead"
  ALTER COLUMN "status" TYPE "LeadStatus" USING ("status"::text::"LeadStatus");
ALTER TABLE "Lead" ALTER COLUMN "status" SET DEFAULT 'new';

ALTER TABLE "LeadStatusEvent"
  ALTER COLUMN "from" TYPE "LeadStatus" USING ("from"::text::"LeadStatus");
ALTER TABLE "LeadStatusEvent"
  ALTER COLUMN "to" TYPE "LeadStatus" USING ("to"::text::"LeadStatus");

DROP TYPE "LeadStatus_old";
