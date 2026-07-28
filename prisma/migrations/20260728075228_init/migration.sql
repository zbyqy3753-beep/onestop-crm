-- CreateEnum
CREATE TYPE "Role" AS ENUM ('owner', 'manager', 'bizManager', 'shopOwner', 'operator', 'agent', 'employee');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('new', 'inProgress', 'contacted', 'quoteSent', 'awaitingClient', 'followUp', 'futureTracking', 'won', 'notRelevant', 'notInterested', 'noAnswer', 'returning', 'soldByCompetitor', 'denies', 'lost');

-- CreateEnum
CREATE TYPE "LeadKind" AS ENUM ('hot', 'data');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('manual', 'import', 'form', 'campaign', 'referral');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('internet', 'mobile', 'tv', 'triple', 'fiber', 'electricity');

-- CreateEnum
CREATE TYPE "LeadCategory" AS ENUM ('mobile', 'internet', 'tv', 'triple', 'electricity', 'general');

-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('bezeq', 'hot', 'yes', 'cellcom', 'partner', 'pelephone', 'golan', 'ibc');

-- CreateEnum
CREATE TYPE "DealStage" AS ENUM ('new', 'sentToAktiv', 'inProgress', 'apiProcess', 'registered', 'awaitingShipment', 'awaitingPorting', 'awaitingInstall', 'active', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('pending', 'handled', 'rejected');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'agent',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "store" TEXT,
    "subscriptionEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "city" TEXT,
    "kind" "LeadKind" NOT NULL DEFAULT 'data',
    "status" "LeadStatus" NOT NULL DEFAULT 'new',
    "priority" "Priority" NOT NULL DEFAULT 'normal',
    "source" "LeadSource" NOT NULL DEFAULT 'manual',
    "category" "LeadCategory",
    "currentProvider" "Provider",
    "assigneeId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastContactAt" TIMESTAMP(3),
    "followUpAt" TIMESTAMP(3),

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadNote" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadStatusEvent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "from" "LeadStatus",
    "to" "LeadStatus" NOT NULL,
    "detail" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "category" "Category" NOT NULL,
    "price" DECIMAL(10,2),
    "commission" DECIMAL(10,2) NOT NULL,
    "spec" JSONB NOT NULL DEFAULT '{}',
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "category" "LeadCategory" NOT NULL,
    "revenue" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "currentStage" "DealStage" NOT NULL DEFAULT 'new',
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealPackage" (
    "dealId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "commissionAtClose" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "DealPackage_pkey" PRIMARY KEY ("dealId","packageId")
);

-- CreateTable
CREATE TABLE "DealStageEvent" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "from" "DealStage",
    "to" "DealStage" NOT NULL,
    "detail" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealStageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadCost" (
    "category" "LeadCategory" NOT NULL,
    "cost" DECIMAL(10,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadCost_pkey" PRIMARY KEY ("category")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "referralSource" TEXT NOT NULL,
    "referredByUserId" TEXT,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledAt" TIMESTAMP(3),
    "handledById" TEXT,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_active_idx" ON "User"("role", "active");

-- CreateIndex
CREATE INDEX "Lead_phone_idx" ON "Lead"("phone");

-- CreateIndex
CREATE INDEX "Lead_status_updatedAt_idx" ON "Lead"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Lead_assigneeId_status_idx" ON "Lead"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "Lead_followUpAt_idx" ON "Lead"("followUpAt");

-- CreateIndex
CREATE INDEX "LeadNote_leadId_createdAt_idx" ON "LeadNote"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "LeadStatusEvent_leadId_createdAt_idx" ON "LeadStatusEvent"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "Package_provider_category_idx" ON "Package"("provider", "category");

-- CreateIndex
CREATE INDEX "Package_active_idx" ON "Package"("active");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_displayId_key" ON "Deal"("displayId");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_leadId_key" ON "Deal"("leadId");

-- CreateIndex
CREATE INDEX "Deal_agentId_closedAt_idx" ON "Deal"("agentId", "closedAt");

-- CreateIndex
CREATE INDEX "Deal_closedAt_idx" ON "Deal"("closedAt");

-- CreateIndex
CREATE INDEX "DealStageEvent_dealId_createdAt_idx" ON "DealStageEvent"("dealId", "createdAt");

-- CreateIndex
CREATE INDEX "Registration_status_createdAt_idx" ON "Registration"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Registration_referredByUserId_idx" ON "Registration"("referredByUserId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadNote" ADD CONSTRAINT "LeadNote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadNote" ADD CONSTRAINT "LeadNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadStatusEvent" ADD CONSTRAINT "LeadStatusEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadStatusEvent" ADD CONSTRAINT "LeadStatusEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealPackage" ADD CONSTRAINT "DealPackage_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealPackage" ADD CONSTRAINT "DealPackage_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealStageEvent" ADD CONSTRAINT "DealStageEvent_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealStageEvent" ADD CONSTRAINT "DealStageEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_referredByUserId_fkey" FOREIGN KEY ("referredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
