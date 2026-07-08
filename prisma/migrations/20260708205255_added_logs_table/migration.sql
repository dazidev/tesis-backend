-- DropIndex
DROP INDEX "user_invitations_token_idx";

-- CreateTable
CREATE TABLE "server_log" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "server_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "server_log_userId_idx" ON "server_log"("userId");

-- CreateIndex
CREATE INDEX "server_log_action_idx" ON "server_log"("action");

-- CreateIndex
CREATE INDEX "server_log_createdAt_idx" ON "server_log"("createdAt");

-- AddForeignKey
ALTER TABLE "server_log" ADD CONSTRAINT "server_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
