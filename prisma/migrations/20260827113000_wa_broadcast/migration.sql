-- CreateEnum
CREATE TYPE "WaCampaignStatus" AS ENUM ('draft', 'sending', 'paused', 'done');

-- AlterTable
ALTER TABLE "WhatsAppMessage" ADD COLUMN     "campaignId" TEXT;

-- CreateTable
CREATE TABLE "WaCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "WaCampaignStatus" NOT NULL DEFAULT 'draft',
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaCampaign_status_createdAt_idx" ON "WaCampaign"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_campaignId_status_idx" ON "WhatsAppMessage"("campaignId", "status");

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "WaCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaCampaign" ADD CONSTRAINT "WaCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

