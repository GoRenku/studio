import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ProjectRelativePath } from '../../client/project/index.js';
import { createProjectDataService } from '../project-data-service.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';

describe('Cast Voice files and defaults', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-cast-voices-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
  });

  it('stores opaque voice identity and restores default selection without replacing newer choices', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const castMember = (await projectData.listCastMembers({
      homeDir,
    }))[0];
    if (!castMember) {
      throw new Error('Expected a Cast Member fixture.');
    }
    await fs.mkdir(path.join(created.projectPath, 'tmp', 'media'), { recursive: true });
    await fs.writeFile(path.join(created.projectPath, 'tmp', 'media', 'first.mp3'), 'first');
    await fs.writeFile(path.join(created.projectPath, 'tmp', 'media', 'second.wav'), 'second');

    const first = await projectData.attachCastVoice({
      projectName: 'constantinople',
      homeDir,
      document: {
        kind: 'castVoiceFileAttachment',
        castMemberId: castMember.id,
        name: 'first-voice',
        purpose: 'Primary dialogue voice',
        voiceIdentity: {
          provider: 'external-provider',
          voiceId: 'opaque-voice-1',
          nested: { model: 'provider-owned-model', controls: [0.25, true] },
        },
        sample: {
          sourceProjectRelativePath: 'tmp/media/first.mp3' as ProjectRelativePath,
          title: 'First voice sample',
        },
      },
    });
    const second = await projectData.attachCastVoice({
      projectName: 'constantinople',
      homeDir,
      document: {
        kind: 'castVoiceFileAttachment',
        castMemberId: castMember.id,
        name: 'second-voice',
        purpose: 'Alternative dialogue voice',
        sample: {
          sourceProjectRelativePath: 'tmp/media/second.wav' as ProjectRelativePath,
          title: 'Second voice sample',
        },
      },
    });

    expect(first.voice).toMatchObject({
      isDefault: true,
      voiceIdentity: {
        provider: 'external-provider',
        voiceId: 'opaque-voice-1',
        nested: { model: 'provider-owned-model', controls: [0.25, true] },
      },
    });
    expect(second.voice).toMatchObject({ isDefault: false, voiceIdentity: null });

    const selected = await projectData.selectDefaultCastVoice({
      projectName: 'constantinople',
      homeDir,
      castMemberId: castMember.id,
      castVoiceId: second.voice.id,
    });

    expect(selected.selectedCastVoiceId).toBe(second.voice.id);
    expect(selected.voices).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: first.voice.id, isDefault: false }),
      expect.objectContaining({ id: second.voice.id, isDefault: true }),
    ]));

    const removedDefault = await projectData.removeCastVoice({
      projectName: 'constantinople',
      homeDir,
      castMemberId: castMember.id,
      voiceIdOrName: second.voice.id,
    });
    const removedDefaultTrashItemId = removedDefault.recovery?.trashItemIds[0];
    if (!removedDefaultTrashItemId) {
      throw new Error('Expected removed default Cast Voice to be recoverable.');
    }
    expect(await projectData.listCastVoices({
      projectName: 'constantinople',
      homeDir,
      castMemberId: castMember.id,
    })).toEqual({
      voices: [expect.objectContaining({ id: first.voice.id, isDefault: false })],
    });

    const restoredDefault = await projectData.restoreTrashItem({
      projectName: 'constantinople',
      homeDir,
      trashItemId: removedDefaultTrashItemId,
    });
    expect(restoredDefault.warnings).toEqual([]);
    expect((await projectData.listCastVoices({
      projectName: 'constantinople',
      homeDir,
      castMemberId: castMember.id,
    })).voices).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: first.voice.id, isDefault: false }),
      expect.objectContaining({ id: second.voice.id, isDefault: true }),
    ]));

    const removedNonDefault = await projectData.removeCastVoice({
      projectName: 'constantinople',
      homeDir,
      castMemberId: castMember.id,
      voiceIdOrName: first.voice.id,
    });
    const removedNonDefaultTrashItemId = removedNonDefault.recovery?.trashItemIds[0];
    if (!removedNonDefaultTrashItemId) {
      throw new Error('Expected removed non-default Cast Voice to be recoverable.');
    }
    await projectData.restoreTrashItem({
      projectName: 'constantinople',
      homeDir,
      trashItemId: removedNonDefaultTrashItemId,
    });
    expect((await projectData.listCastVoices({
      projectName: 'constantinople',
      homeDir,
      castMemberId: castMember.id,
    })).voices).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: first.voice.id, isDefault: false }),
      expect.objectContaining({ id: second.voice.id, isDefault: true }),
    ]));

    const removedDefaultAgain = await projectData.removeCastVoice({
      projectName: 'constantinople',
      homeDir,
      castMemberId: castMember.id,
      voiceIdOrName: second.voice.id,
    });
    const removedDefaultAgainTrashItemId = removedDefaultAgain.recovery?.trashItemIds[0];
    if (!removedDefaultAgainTrashItemId) {
      throw new Error('Expected removed default Cast Voice to be recoverable.');
    }
    await projectData.selectDefaultCastVoice({
      projectName: 'constantinople',
      homeDir,
      castMemberId: castMember.id,
      castVoiceId: first.voice.id,
    });
    const restoredWithConflict = await projectData.restoreTrashItem({
      projectName: 'constantinople',
      homeDir,
      trashItemId: removedDefaultAgainTrashItemId,
    });
    expect(restoredWithConflict.warnings).toEqual([
      expect.objectContaining({
        code: 'CORE_TRASH_CAST_VOICE_DEFAULT_CONFLICT',
        severity: 'warning',
      }),
    ]);
    expect((await projectData.listCastVoices({
      projectName: 'constantinople',
      homeDir,
      castMemberId: castMember.id,
    })).voices).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: first.voice.id, isDefault: true }),
      expect.objectContaining({ id: second.voice.id, isDefault: false }),
    ]));
  });
});
