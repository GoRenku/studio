import { describe, expect, it, vi } from 'vitest';
import { mediaImportCommandHandler } from './media-import-command-handlers.js';

vi.mock('./studio-resource-event-command.js', () => ({ appendStudioResourceChangedEvent: vi.fn() }));

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

  it('passes the saved agent-external spec id to Core', async () => {
    const attachGenerationMedia = vi.fn().mockResolvedValue({ valid: true, purpose: 'cast.profile', provenance: { generationSpecId: 'spec_codex' }, project: { name: 'movie', id: 'project_1' }, resourceKeys: [] });
    await mediaImportCommandHandler.run({
      flags: {
        purpose: 'cast.profile',
        target: 'cast:hero',
        source: 'tmp/profile.png',
        sourceSpec: 'spec_codex',
      },
      runtime: { projectName: 'movie', projectDataService: { attachGenerationMedia } },
    } as never);
    expect(attachGenerationMedia).toHaveBeenCalledWith(expect.objectContaining({
      sourceSpecId: 'spec_codex',
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
});
