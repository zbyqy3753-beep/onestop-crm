-- CreateEnum
CREATE TYPE "RenewalContactStatus" AS ENUM ('pending', 'queued', 'awaitingReply', 'needsReview', 'scheduled', 'declined', 'optedOut', 'noReply', 'failed');

-- CreateTable
CREATE TABLE "RenewalContact" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "pageIndex" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "city" TEXT,
    "email" TEXT,
    "provider" TEXT,
    "packageName" TEXT,
    "serviceType" TEXT,
    "currentPrice" DECIMAL(10,2),
    "futurePrice" DECIMAL(10,2),
    "contractEndsAt" TIMESTAMP(3),
    "status" "RenewalContactStatus" NOT NULL DEFAULT 'pending',
    "rawText" TEXT NOT NULL,
    "agreedAt" TIMESTAMP(3),
    "leadId" TEXT,
    "sentAt" TIMESTAMP(3),
    "lastInboundAt" TIMESTAMP(3),
    "lastInboundText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RenewalContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppInbound" (
    "id" TEXT NOT NULL,
    "waMessageId" TEXT NOT NULL,
    "fromPhone" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "contactId" TEXT,
    "parsed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppInbound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RenewalContact_phone_idx" ON "RenewalContact"("phone");

-- CreateIndex
CREATE INDEX "RenewalContact_status_createdAt_idx" ON "RenewalContact"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RenewalContact_documentId_pageIndex_key" ON "RenewalContact"("documentId", "pageIndex");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppInbound_waMessageId_key" ON "WhatsAppInbound"("waMessageId");

-- CreateIndex
CREATE INDEX "WhatsAppInbound_fromPhone_receivedAt_idx" ON "WhatsAppInbound"("fromPhone", "receivedAt");

-- AddForeignKey
ALTER TABLE "RenewalContact" ADD CONSTRAINT "RenewalContact_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "RenewalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalContact" ADD CONSTRAINT "RenewalContact_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
