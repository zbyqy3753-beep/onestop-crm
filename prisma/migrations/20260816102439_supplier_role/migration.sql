-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'supplier';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "leadSourceName" TEXT;
