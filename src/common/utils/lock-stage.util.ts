import { Prisma } from 'src/generated/prisma/client';

export async function lockStage(tx: Prisma.TransactionClient, stageId: string) {
  const stage = await tx.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM "process_stages"
      WHERE id = ${stageId}
      FOR UPDATE
    `;

  if (stage.length === 0) {
    throw new Error('The stage was not found');
  }
}
