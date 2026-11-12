import { Prisma } from 'src/generated/prisma/client';

// Serialize role/status changes and process assignments before checking access.
export async function lockUserAdministration(tx: Prisma.TransactionClient) {
  await tx.$queryRaw`
    SELECT 1 AS locked
    FROM pg_advisory_xact_lock(hashtext('tesis:user-administration'))
  `;
}
