-- AlterEnum
-- אחרון בהצהרה, ולכן הוספה רגילה בסוף היא המיקום הנכון.
ALTER TYPE "LeadCategory" ADD VALUE 'recycled';

-- AlterEnum
-- ⚠️ `AFTER 'new'` ולא הוספה בסוף.
--
-- Postgres ממיין enum לפי סדר היצירה, והרפוזיטורי נשען על כך:
-- `orderBy: { status: dir }` במסך הלידים מסתמך על כך שסדר הערכים
-- כאן זהה ל-STATUS_ORDER ב-types.ts. Prisma מייצר תמיד הוספה בסוף,
-- מה שהיה ממקם "ממחזור" אחרי "הפסד" וממיין ליד חדש לתחתית הטבלה.
ALTER TYPE "LeadStatus" ADD VALUE 'recycled' AFTER 'new';
