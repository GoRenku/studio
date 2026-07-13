import type { ShotVideoTakeWorkspaceMutationReport } from '../../client/shot-video-take-workspace.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { ProjectIdGenerator } from '../entity-ids.js';
import { attachGenerationMedia } from '../generation/attachments.js';
import { requireShotVideoTakeForScene } from './queries.js';
import { readShotVideoTakeWorkspace } from './workspace.js';

export async function attachShotVideoTakeOutput(input: {
  session: DatabaseSession;
  projectFolder: string;
  sceneId: string;
  takeId: string;
  sourceProjectRelativePath: string;
  title?: string;
  receipt: unknown;
  idGenerator: ProjectIdGenerator;
}): Promise<ShotVideoTakeWorkspaceMutationReport> {
  requireShotVideoTakeForScene(input);
  const attachment = attachGenerationMedia({
    purpose: 'shot.video-take',
    target: { kind: 'sceneShotVideoTake', id: input.takeId },
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    ...(input.title ? { title: input.title } : {}),
    receipt: input.receipt,
    session: input.session,
    projectFolder: input.projectFolder,
    idGenerator: input.idGenerator,
  });
  return {
    workspace: await readShotVideoTakeWorkspace(input),
    resourceKeys: attachment.resourceKeys,
  };
}
