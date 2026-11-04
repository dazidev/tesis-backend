-- AlterTable
ALTER TABLE "user_invitations" ADD COLUMN     "emailSentAt" TIMESTAMPTZ,
ADD COLUMN     "lastEmailErrorAt" TIMESTAMPTZ,
ALTER COLUMN "usedAt" SET DATA TYPE TIMESTAMPTZ;
