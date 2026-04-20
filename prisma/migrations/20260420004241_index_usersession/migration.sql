-- DropIndex
DROP INDEX "user_sessions_userId_isRevoked_expiresAt_idx";

-- CreateIndex
CREATE INDEX "user_sessions_userId_isRevoked_idx" ON "user_sessions"("userId", "isRevoked");
