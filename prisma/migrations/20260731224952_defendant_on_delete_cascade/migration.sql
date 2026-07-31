-- DropForeignKey
ALTER TABLE "processes" DROP CONSTRAINT "processes_defendantId_fkey";

-- AddForeignKey
ALTER TABLE "processes" ADD CONSTRAINT "processes_defendantId_fkey" FOREIGN KEY ("defendantId") REFERENCES "defendants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
