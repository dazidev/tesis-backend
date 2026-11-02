-- AlterTable
ALTER TABLE "user_invitations" ADD COLUMN     "processId" TEXT,
ALTER COLUMN "usedAt" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "process_clients" (
    "processId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "process_clients_pkey" PRIMARY KEY ("processId","clientId")
);

-- CreateIndex
CREATE INDEX "process_clients_clientId_idx" ON "process_clients"("clientId");

-- CreateIndex
CREATE INDEX "user_invitations_processId_idx" ON "user_invitations"("processId");

-- AddForeignKey
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_clients" ADD CONSTRAINT "process_clients_processId_fkey" FOREIGN KEY ("processId") REFERENCES "processes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_clients" ADD CONSTRAINT "process_clients_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
