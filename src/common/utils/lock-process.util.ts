import { Prisma } from 'src/generated/prisma/client';

export async function lockProcess(
  tx: Prisma.TransactionClient,
  processId: string,
) {
  const process = await tx.$queryRaw<{ id: string }[]>`
    SELECT id
    FROM "processes"
    WHERE id = ${processId}
    FOR UPDATE
  `;

  if (process.length === 0) {
    throw new Error('The process was not found');
  }
}
