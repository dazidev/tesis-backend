import { SubstageStatus } from 'src/generated/prisma/client';

export type FlatSubstage = {
  id: string;
  name: string;
  description: string;
  status: SubstageStatus;
  order: number;
  stageId: string;
  parentSubstageId: string | null;
};

export type SubstageNode = {
  id: string;
  name: string;
  description: string;
  status: SubstageStatus;
  order: number;
  stageId: string;
  parentSubstageId: string | null;
  childrenSubstages: SubstageNode[];
};

export function buildTree(
  flatSubstages: FlatSubstage[],
): Record<string, SubstageNode[]> {
  const map = new Map<string, SubstageNode>();
  const rootsByStage: Record<string, SubstageNode[]> = {};

  for (const item of flatSubstages) {
    map.set(item.id, {
      id: item.id,
      name: item.name,
      description: item.description,
      status: item.status,
      order: item.order,
      stageId: item.stageId,
      parentSubstageId: item.parentSubstageId,
      childrenSubstages: [],
    });
  }

  for (const item of flatSubstages) {
    const node = map.get(item.id)!;

    if (item.parentSubstageId === null) {
      if (!rootsByStage[item.stageId]) {
        rootsByStage[item.stageId] = [];
      }
      rootsByStage[item.stageId].push(node);
    } else {
      const parentNode = map.get(item.parentSubstageId);
      parentNode?.childrenSubstages.push(node);
    }
  }
  return rootsByStage;
}
