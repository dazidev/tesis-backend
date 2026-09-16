-- AlterTable
ALTER TABLE "digital_file" ADD COLUMN     "deletedAt" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "digital_folder" ADD COLUMN     "deletedAt" TIMESTAMPTZ;
