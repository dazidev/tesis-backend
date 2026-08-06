/*
  Warnings:

  - Added the required column `order` to the `process_stages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `order` to the `process_substages` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "process_stages" ADD COLUMN     "order" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "process_substages" ADD COLUMN     "order" INTEGER NOT NULL;
