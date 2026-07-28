import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * סינגלטון של Prisma Client.
 *
 * Next.js מרענן מודולים בכל שינוי קוד ב-dev. בלי הסינגלטון הזה,
 * כל hot-reload היה יוצר חיבור חדש ל-DB עד שהפול נגמר.
 * `globalThis` שורד בין רענונים; ב-production כל תהליך מקבל
 * מופע אחד ממילא.
 */

declare global {
  var __prisma: PrismaClient | undefined;
}

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL חסר. הגדר אותו ב-.env כדי להשתמש ב-DATA_SOURCE=prisma.",
    );
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalThis.__prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
