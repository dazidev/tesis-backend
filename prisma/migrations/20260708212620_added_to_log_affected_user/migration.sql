-- DropForeignKey
ALTER TABLE "server_log" DROP CONSTRAINT "server_log_userId_fkey";

-- AlterTable
ALTER TABLE "server_log" ADD COLUMN     "affectedUserId" TEXT;

-- AddForeignKey
ALTER TABLE "server_log" ADD CONSTRAINT "server_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "server_log" ADD CONSTRAINT "server_log_affectedUserId_fkey" FOREIGN KEY ("affectedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
