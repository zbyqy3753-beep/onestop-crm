/**
 * אין נתוני זרע עסקיים — המערכת מתחילה ריקה לגמרי.
 *
 * השורה היחידה שכן נזרעת: משתמש הפיתוח (DEV_USER, src/lib/domain/seed.ts).
 * `getSessionUser` מחזיר אותו תמיד — אין עדיין אימות אמיתי — כך שכל פעולת
 * כתיבה (יצירת ליד וכו') דורשת שהשורה הזו תתקיים ב-DB בפועל, אחרת
 * מפתחות זרים (createdById/assigneeId) נכשלים.
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { DEV_USER } from "../src/lib/domain/seed";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  await prisma.user.upsert({
    where: { id: DEV_USER.id },
    create: {
      id: DEV_USER.id,
      name: DEV_USER.name,
      email: DEV_USER.email,
      role: DEV_USER.role,
      active: DEV_USER.active,
    },
    update: {},
  });

  console.log("נזרע: משתמש הפיתוח.");
  await prisma.$disconnect();
}

main();
