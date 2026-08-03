-- CreateTable
CREATE TABLE "BotSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "pausedReason" TEXT,
    "pausedAt" TIMESTAMP(3),
    "sendWindowStartHour" INTEGER NOT NULL DEFAULT 8,
    "sendWindowEndHour" INTEGER NOT NULL DEFAULT 21,
    "dailyCap" INTEGER NOT NULL DEFAULT 200,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "BotSettings_pkey" PRIMARY KEY ("id")
);
