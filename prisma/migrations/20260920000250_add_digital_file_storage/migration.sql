/*
  Warnings:

  - A unique constraint covering the columns `[storagePath]` on the table `digital_file` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `mimeType` to the `digital_file` table without a default value. This is not possible if the table is not empty.
  - Added the required column `originalName` to the `digital_file` table without a default value. This is not possible if the table is not empty.
  - Added the required column `size` to the `digital_file` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storagePath` to the `digital_file` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "digital_file" ADD COLUMN     "mimeType" TEXT NOT NULL,
ADD COLUMN     "originalName" TEXT NOT NULL,
ADD COLUMN     "size" INTEGER NOT NULL,
ADD COLUMN     "storagePath" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "digital_file_storagePath_key" ON "digital_file"("storagePath");
