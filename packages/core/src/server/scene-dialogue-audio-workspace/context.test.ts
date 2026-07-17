import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProjectDataService } from '../project-data-service.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';

describe('Scene Dialogue Audio workspace context', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-dialogue-context-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
  });

  it('returns the current Dialogue Audio surface key', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const screenplay = await projectData.readScreenplay({
      homeDir,
    });
    const sceneId = screenplay.screenplay?.acts[0]?.sequences[0]?.scenes[0]?.id;
    expect(sceneId).toBeTruthy();

    const workspace = await projectData.readSceneDialogueAudioWorkspace({
      projectName: 'constantinople',
      homeDir,
      sceneId: sceneId!,
    });
    expect(workspace.resourceKeys).toEqual([
      `surface:scene:${sceneId}:dialogue-audio`,
    ]);
  });
});
