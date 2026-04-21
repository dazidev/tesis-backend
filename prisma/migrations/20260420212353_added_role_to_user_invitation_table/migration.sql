/*
  Warnings:

  - Added the required column `role` to the `user_invitations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "user_invitations" ADD COLUMN     "role" "UserRole" NOT NULL;
