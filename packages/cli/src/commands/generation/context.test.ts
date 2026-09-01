import { describe, expect, it, vi } from 'vitest';
import { showGenerationContext } from './context.js';

describe('generation context command', () => {
  it('parses purpose, target, revision, and repeatable Beat scope before delegating once', async () => {
    const readMediaGenerationContext = vi.fn(async (input) => ({ valid: true, ...input }));
    const result = await showGenerationContext({
      flags: {
        purpose: 'scene.storyboard-sheet',
        target: 'scene:scene_1',
        revision: 'revision_1',
        beat: ['beat_2', 'beat_1'],
      },
      runtime: {
        projectName: 'movie',
        homeDir: '/tmp/home',
        projectDataService: { readMediaGenerationContext },
      },
    } as never);
    expect(readMediaGenerationContext).toHaveBeenCalledOnce();
    expect(readMediaGenerationContext).toHaveBeenCalledWith({
      projectName: 'movie',
      homeDir: '/tmp/home',
      purpose: 'scene.storyboard-sheet',
      target: { kind: 'scene', id: 'scene_1' },
      sceneStoryboardScope: {
        sceneBeatsRevisionId: 'revision_1',
        beatIds: ['beat_2', 'beat_1'],
      },
    });
    expect(result).toMatchObject({ valid: true, purpose: 'scene.storyboard-sheet' });
  });

  it('does not invent a scope for other purposes', async () => {
    const readMediaGenerationContext = vi.fn(async (input) => input);
    await showGenerationContext({
      flags: { purpose: 'cast.profile', target: 'cast:cast_1' },
      runtime: { projectDataService: { readMediaGenerationContext } },
    } as never);
    expect(readMediaGenerationContext).toHaveBeenCalledWith({
      purpose: 'cast.profile',
      target: { kind: 'castMember', id: 'cast_1' },
    });
  });

  it('preserves the exact Shot Plan dialogue target', async () => {
    const readMediaGenerationContext = vi.fn(async (input) => input);
    await showGenerationContext({
      flags: {
        purpose: 'shot-plan.dialogue-audio',
        target: 'shot-plan:shot_plan_1',
      },
      runtime: { projectDataService: { readMediaGenerationContext } },
    } as never);
    expect(readMediaGenerationContext).toHaveBeenCalledWith({
      purpose: 'shot-plan.dialogue-audio',
      target: { kind: 'shotPlan', id: 'shot_plan_1' },
    });
  });
});
