import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { mediaImportCommandHandler } from './command.js';

vi.mock('../studio-resource-event-command.js', () => ({ appendStudioResourceChangedEvent: vi.fn() }));

describe('media import command handler', () => {
  it('uses the focused Core attachment boundary without generation provenance', async () => {
    const attachGenerationMedia = vi.fn().mockResolvedValue({ valid: true, purpose: 'cast.profile', provenance: null, project: { name: 'movie', id: 'project_1' }, resourceKeys: [] });
    const result = await mediaImportCommandHandler.run({
      flags: { purpose: 'cast.profile', target: 'cast:hero', source: 'tmp/profile.png' },
      runtime: { projectName: 'movie', projectDataService: { attachGenerationMedia } },
    } as never);
    expect(result).toMatchObject({ provenance: null });
    expect(attachGenerationMedia).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'cast.profile', target: { kind: 'castMember', id: 'hero' }, sourceProjectRelativePath: 'tmp/profile.png' }));
  });

  it('passes exact saved provenance to Core', async () => {
    const provenance = { provider: 'codex', model: 'gpt-image-2', mediaKind: 'image', prompt: 'portrait', request: { prompt: 'portrait' } } as const;
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-media-provenance-'));
    const provenanceFile = path.join(directory, 'provenance.json');
    await fs.writeFile(provenanceFile, JSON.stringify(provenance));
    const attachGenerationMedia = vi.fn().mockResolvedValue({ valid: true, purpose: 'cast.profile', generationProvenance: provenance, project: { name: 'movie', id: 'project_1' }, resourceKeys: [] });
    await mediaImportCommandHandler.run({
      flags: {
        purpose: 'cast.profile',
        target: 'cast:hero',
        source: 'tmp/profile.png',
        provenance: provenanceFile,
      },
      runtime: { projectName: 'movie', projectDataService: { attachGenerationMedia } },
    } as never);
    expect(attachGenerationMedia).toHaveBeenCalledWith(expect.objectContaining({
      generationProvenance: provenance,
    }));
  });

  it('passes focused Asset metadata without interpreting repeated tags', async () => {
    const attachGenerationMedia = vi.fn().mockResolvedValue({ valid: true, purpose: 'cast.character-sheet', provenance: null, project: { name: 'movie', id: 'project_1' }, resourceKeys: [] });
    await mediaImportCommandHandler.run({
      flags: {
        purpose: 'cast.character-sheet',
        target: 'cast:hero',
        source: 'tmp/sheet.png',
        summary: 'Storyboard continuity rendering.',
        referenceName: 'hero-storyboard',
        tag: ['previs', 'storyboard'],
      },
      runtime: { projectName: 'movie', projectDataService: { attachGenerationMedia } },
    } as never);
    expect(attachGenerationMedia).toHaveBeenCalledWith(expect.objectContaining({
      assetMetadata: {
        oneLineSummary: 'Storyboard continuity rendering.',
        referenceName: 'hero-storyboard',
        tags: ['previs', 'storyboard'],
      },
    }));
  });

  it('passes an agent-cropped Storyboard image to the focused Scene attachment command', async () => {
    const attachSceneStoryboardImages = vi.fn().mockResolvedValue({ valid: true, purpose: 'scene.storyboard-sheet', project: { name: 'movie', id: 'project_1' }, resourceKeys: [] });
    await mediaImportCommandHandler.run({
      flags: { purpose: 'scene.storyboard-sheet', target: 'scene:scene_1', revision: 'scene_beats_revision_1', beats: 'beat_1', source: 'tmp/media/beat-1.png' },
      runtime: { projectName: 'movie', projectDataService: { attachSceneStoryboardImages } },
    } as never);
    expect(attachSceneStoryboardImages).toHaveBeenCalledWith(expect.objectContaining({
      sceneId: 'scene_1',
      sceneBeatsRevisionId: 'scene_beats_revision_1',
      document: expect.objectContaining({ beats: [expect.objectContaining({ beatId: 'beat_1', source: 'tmp/media/beat-1.png' })] }),
    }));
  });

  it('passes one consecutive Dialogue Turn range to Core', async () => {
    const provenance = {
      provider: 'fal-ai',
      model: 'bytedance/seed-audio-1.0',
      mediaKind: 'audio',
      prompt: 'Exact dialogue.',
      request: { prompt: 'Exact dialogue.' },
    } as const;
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-dialogue-audio-'));
    const provenanceFile = path.join(directory, 'provenance.json');
    await fs.writeFile(provenanceFile, JSON.stringify(provenance));
    const attachGenerationMedia = vi.fn().mockResolvedValue({
      valid: true,
      purpose: 'shot-plan.dialogue-audio',
      project: { name: 'movie', id: 'project_1' },
      resourceKeys: [],
    });

    await mediaImportCommandHandler.run({
      flags: {
        purpose: 'shot-plan.dialogue-audio',
        target: 'shot-plan:shot_plan_1',
        turns: '2-4',
        source: 'tmp/media/dialogue.mp3',
        provenance: provenanceFile,
      },
      runtime: { projectName: 'movie', projectDataService: { attachGenerationMedia } },
    } as never);

    expect(attachGenerationMedia).toHaveBeenCalledWith(expect.objectContaining({
      purpose: 'shot-plan.dialogue-audio',
      target: { kind: 'shotPlan', id: 'shot_plan_1' },
      turnRange: { start: 2, end: 4 },
    }));
  });
});
