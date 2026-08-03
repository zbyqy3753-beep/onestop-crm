-- AlterEnum
ALTER TYPE "LeadStatus" ADD VALUE 'existingCustomer';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "noAnswerCount" INTEGER NOT NULL DEFAULT 0;
