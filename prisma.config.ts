import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * תצורת Prisma 7. חיבור ה-URL עבר לכאן מ-schema.prisma — זו הדרך
 * הנוכחית, לא מנהג ישן. `DATABASE_URL` נטען מ-.env דרך dotenv,
 * כי prisma.config.ts רץ מחוץ להקשר של Next.js.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
