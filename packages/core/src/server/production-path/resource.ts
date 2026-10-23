import type { ProductionPathResource } from '../../client/production-path.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { ReadProjectInput } from '../project-data-service-contracts.js';
import { productionPathStageReaders } from './stage-order.js';

export async function readProductionPathResource(
  input: ReadProjectInput
): Promise<ProductionPathResource> {
  const { session } = await openProjectSession(input);
  try {
    return readProductionPathFromSession(session);
  } finally {
    session.close();
  }
}

export function readProductionPathFromSession(session: DatabaseSession): ProductionPathResource {
  const stages = productionPathStageReaders.map((readStage) => readStage(session));
  return {
    stages,
    nextStageId: stages.find((stage) => stage.status !== 'complete')?.id ?? null,
  };
}
