/*
  Warnings:

  - You are about to drop the column `affectedUserId` on the `server_log` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "server_log" DROP CONSTRAINT "server_log_affectedUserId_fkey";

-- AlterTable
ALTER TABLE "server_log" DROP COLUMN "affectedUserId",
ADD COLUMN     "affected" TEXT,
ADD COLUMN     "entity" TEXT;
