import "server-only";

import type { Repositories } from "./types";
import { memoryRepositories } from "./memory";

export type * from "./types";

/**
 * נקודת הכניסה היחידה לשכבת הנתונים.
 *
 * זו הנקודה שבה מחליפים מקור נתונים. `DATA_SOURCE=prisma` ב-.env
 * מפנה את כל האפליקציה ל-Postgres בלי לגעת בשום קומפוננטה.
 *
 * הייבוא של `./prisma` הוא דינמי ובכוונה: `./prisma/index.ts` מייבא
 * את הסינגלטון של Prisma Client, שבונה חיבור אמיתי ל-DB כבר
 * ב-import. אם הייבוא היה סטטי, אפילו הרצה עם DATA_SOURCE=memory
 * (ברירת המחדל, בלי DATABASE_URL בכלל) הייתה מנסה להתחבר ל-Postgres
 * ונופלת. ה-`await` ברמת המודול נתמך ב-Next.js לקבצי שרת.
 *
 * `server-only` מבטיח שאם קומפוננטת לקוח תייבא את זה בטעות,
 * הבנייה תיכשל במקום שהנתונים יזלגו לדפדפן.
 */
async function resolve(): Promise<Repositories> {
  const source = process.env.DATA_SOURCE ?? "memory";

  switch (source) {
    case "memory":
      return memoryRepositories;

    case "prisma": {
      const { createPrismaRepositories } = await import("./prisma");
      return createPrismaRepositories();
    }

    default:
      throw new Error(
        `DATA_SOURCE לא מוכר: "${source}". ערכים אפשריים: memory | prisma`,
      );
  }
}

export const db: Repositories = await resolve();
