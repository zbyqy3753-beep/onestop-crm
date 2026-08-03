-- CreateEnum
CREATE TYPE "WaMessageStatus" AS ENUM ('queued', 'sending', 'sent', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "toPhone" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "WaMessageStatus" NOT NULL DEFAULT 'queued',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "claimedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "leadId" TEXT,
    "recipientUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotHeartbeat" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "waConnected" BOOLEAN NOT NULL DEFAULT false,
    "waNumber" TEXT,
    "instanceId" TEXT,
    "queuedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BotHeartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppMessage_dedupeKey_key" ON "WhatsAppMessage"("dedupeKey");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_status_scheduledFor_idx" ON "WhatsAppMessage"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_leadId_status_idx" ON "WhatsAppMessage"("leadId", "status");

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
