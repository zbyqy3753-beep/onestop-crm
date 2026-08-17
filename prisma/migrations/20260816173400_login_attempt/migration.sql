-- CreateTable
CREATE TABLE "LoginAttempt" (
    "loginId" TEXT NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "lastFailedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("loginId")
);

-- CreateIndex
CREATE INDEX "LoginAttempt_lockedUntil_idx" ON "LoginAttempt"("lockedUntil");
