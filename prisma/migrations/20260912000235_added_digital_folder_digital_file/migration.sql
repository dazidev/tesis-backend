-- CreateTable
CREATE TABLE "digital_folder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "substageId" TEXT,

    CONSTRAINT "digital_folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digital_file" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "digitalFolderId" TEXT NOT NULL,

    CONSTRAINT "digital_file_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "digital_folder_stageId_idx" ON "digital_folder"("stageId");

-- CreateIndex
CREATE INDEX "digital_folder_substageId_idx" ON "digital_folder"("substageId");

-- AddForeignKey
ALTER TABLE "digital_folder" ADD CONSTRAINT "digital_folder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_folder" ADD CONSTRAINT "digital_folder_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "process_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_folder" ADD CONSTRAINT "digital_folder_substageId_fkey" FOREIGN KEY ("substageId") REFERENCES "process_substages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_file" ADD CONSTRAINT "digital_file_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_file" ADD CONSTRAINT "digital_file_digitalFolderId_fkey" FOREIGN KEY ("digitalFolderId") REFERENCES "digital_folder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
