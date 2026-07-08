import type {
  SceneShotVideoTake,
} from '../../../../../client/index.js';
import type {
  DatabaseSession,
} from '../../../../database/lifecycle/store.js';
import {
  resolveShotVideoTakeMediaFolderSync,
} from '../../../../project-asset-files/index.js';

export function resolveShotVideoTakeFolder(input: {
  session: DatabaseSession;
  projectFolder: string;
  take: SceneShotVideoTake;
  now: string;
}) {
  return resolveShotVideoTakeMediaFolderSync({
    session: input.session,
    projectFolder: input.projectFolder,
    takeId: input.take.takeId,
    now: input.now,
  });
}
