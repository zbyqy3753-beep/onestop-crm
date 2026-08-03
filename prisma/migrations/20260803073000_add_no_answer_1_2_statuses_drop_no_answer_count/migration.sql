-- AlterEnum
ALTER TYPE "LeadStatus" ADD VALUE 'noAnswer1';
ALTER TYPE "LeadStatus" ADD VALUE 'noAnswer2';

-- AlterTable
ALTER TABLE "Lead" DROP COLUMN "noAnswerCount";
