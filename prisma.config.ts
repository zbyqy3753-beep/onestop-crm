import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * תצורת Prisma 7. חיבור ה-URL עבר לכאן מ-schema.prisma — זו הדרך
 * הנוכחית, לא מנהג ישן. `DIRECT_URL` נטען מ-.env דרך dotenv,
 * כי prisma.config.ts רץ מחוץ להקשר של Next.js.
 *
 * משתמש ב-DIRECT_URL (חיבור ישיר, לא מאוגם) ולא ב-DATABASE_URL —
 * כלי המיגרציה של Prisma זקוקים לחיבור ישיר מול Postgres; ה-pooler
 * המשותף (pgbouncer, transaction mode) לא תומך בפעולות DDL/prepared
 * statements שמיגרציות דורשות.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
