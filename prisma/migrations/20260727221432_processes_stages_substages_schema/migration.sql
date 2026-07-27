/*
  Warnings:

  - You are about to drop the column `lawyerId` on the `users` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ProcessType" AS ENUM ('testate', 'intestate', 'mixed');

-- CreateEnum
CREATE TYPE "ProcessStatus" AS ENUM ('created', 'opened', 'closed', 'deleted');

-- CreateEnum
CREATE TYPE "StageStatus" AS ENUM ('created', 'opened', 'closed');

-- CreateEnum
CREATE TYPE "SubstageStatus" AS ENUM ('opened', 'closed', 'deleted');

-- DropIndex
DROP INDEX "users_email_idx";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "lawyerId";

-- CreateTable
CREATE TABLE "defendants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastname" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "deathDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "defendants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processes" (
    "id" TEXT NOT NULL,
    "courtNumber" TEXT NOT NULL,
    "caseFileNumber" TEXT NOT NULL,
    "type" "ProcessType" NOT NULL,
    "status" "ProcessStatus" NOT NULL,
    "defendantId" TEXT NOT NULL,
    "managedByID" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_stages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "StageStatus" NOT NULL,
    "processId" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "process_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "process_substages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "SubstageStatus" NOT NULL,
    "stageId" TEXT NOT NULL,
    "parentSubstageId" TEXT,

    CONSTRAINT "process_substages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ClientLawyers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ClientLawyers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_Plaintiff" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_Plaintiff_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "defendants_id_idx" ON "defendants"("id");

-- CreateIndex
CREATE UNIQUE INDEX "processes_defendantId_key" ON "processes"("defendantId");

-- CreateIndex
CREATE INDEX "processes_courtNumber_idx" ON "processes"("courtNumber");

-- CreateIndex
CREATE INDEX "processes_caseFileNumber_idx" ON "processes"("caseFileNumber");

-- CreateIndex
CREATE INDEX "processes_type_idx" ON "processes"("type");

-- CreateIndex
CREATE INDEX "process_substages_stageId_idx" ON "process_substages"("stageId");

-- CreateIndex
CREATE INDEX "process_substages_parentSubstageId_idx" ON "process_substages"("parentSubstageId");

-- CreateIndex
CREATE INDEX "_ClientLawyers_B_index" ON "_ClientLawyers"("B");

-- CreateIndex
CREATE INDEX "_Plaintiff_B_index" ON "_Plaintiff"("B");

-- AddForeignKey
ALTER TABLE "processes" ADD CONSTRAINT "processes_defendantId_fkey" FOREIGN KEY ("defendantId") REFERENCES "defendants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processes" ADD CONSTRAINT "processes_managedByID_fkey" FOREIGN KEY ("managedByID") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processes" ADD CONSTRAINT "processes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_stages" ADD CONSTRAINT "process_stages_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_substages" ADD CONSTRAINT "process_substages_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "process_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_substages" ADD CONSTRAINT "process_substages_parentSubstageId_fkey" FOREIGN KEY ("parentSubstageId") REFERENCES "process_substages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClientLawyers" ADD CONSTRAINT "_ClientLawyers_A_fkey" FOREIGN KEY ("A") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClientLawyers" ADD CONSTRAINT "_ClientLawyers_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Plaintiff" ADD CONSTRAINT "_Plaintiff_A_fkey" FOREIGN KEY ("A") REFERENCES "processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Plaintiff" ADD CONSTRAINT "_Plaintiff_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
