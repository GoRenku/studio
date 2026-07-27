import type { SceneDesignResource } from '../../client/index.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { listAssetPageInSession } from '../assets/projection.js';
import { readSceneNavigationContext } from '../database/access/navigation.js';
import { ProjectDataError } from '../project-data-error.js';
import type { ReadSceneDesignResourceInput } from '../project-data-service-contracts.js';

export async function readSceneDesignResource(
  input: ReadSceneDesignResourceInput
): Promise<SceneDesignResource> {
  const { session } = await openProjectSession(input);
  try {
    return readSceneDesignResourceProjection(session, input);
  } finally {
    session.close();
  }
}

export function readSceneDesignResourceProjection(
  session: DatabaseSession,
  input: {
    sceneId: string;
    activeRole?: string;
    limit?: number;
    cursor?: string | null;
  }
): SceneDesignResource {
  const chain = readSceneNavigationContext(session, input.sceneId);
  if (!chain) {
    throw new ProjectDataError('PROJECT_DATA114', `Scene was not found: ${input.sceneId}.`);
  }
  const owner = { kind: 'scene' as const, id: input.sceneId };
  return {
    scene: chain.scene,
    sequence: chain.sequence,
    assetPage: listAssetPageInSession(session, {
      owner,
      type: input.activeRole,
      limit: input.limit,
      cursor: input.cursor,
    }),
  };
}
