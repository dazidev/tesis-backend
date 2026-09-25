-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dueDate" TIMESTAMPTZ NOT NULL,
    "completedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,
    "createdById" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "substageId" TEXT,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tasks_stageId_idx" ON "tasks"("stageId");

-- CreateIndex
CREATE INDEX "tasks_substageId_idx" ON "tasks"("substageId");

-- CreateIndex
CREATE INDEX "tasks_deletedAt_completedAt_dueDate_idx" ON "tasks"("deletedAt", "completedAt", "dueDate");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "process_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_substageId_fkey" FOREIGN KEY ("substageId") REFERENCES "process_substages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
