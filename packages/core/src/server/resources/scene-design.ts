import type { SceneDesignResource } from '../../client/index.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  listAssetRelationshipPage,
  MAX_RESOURCE_PAGE_LIMIT,
} from '../database/access/asset-relationships/index.js';
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
  const target = { kind: 'scene' as const, sceneId: input.sceneId };
  return {
    scene: chain.scene,
    sequence: chain.sequence,
    selectedAssets: listAssetRelationshipPage(session, {
      target,
      selection: 'select',
      limit: MAX_RESOURCE_PAGE_LIMIT,
    }).items,
    activeTakePage: listAssetRelationshipPage(session, {
      target,
      role: input.activeRole,
      selection: 'take',
      limit: input.limit,
      cursor: input.cursor,
    }),
  };
}
