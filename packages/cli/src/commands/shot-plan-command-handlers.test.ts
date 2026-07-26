import type { ProjectDataService } from '@gorenku/studio-core/server';
import { describe, expect, it, vi } from 'vitest';
import { shotPlanCommandHandlers } from './shot-plan-command-handlers.js';
import { corePosition } from './shot-plan-shot-command-handlers.js';

describe('Shot Plan command handlers', () => {
  it('maps one-based CLI positions to zero-based Core positions', () => {
    expect(corePosition(1)).toBe(0);
    expect(corePosition(4)).toBe(3);
    for (const position of [undefined, 0, -1, 1.5]) {
      expect(() => corePosition(position)).toThrowError(
        expect.objectContaining({ code: 'CLI152' })
      );
    }
  });

  it('delegates a move without reading or replacing the Shot Plan', async () => {
    const moveShotInPlan = vi.fn().mockResolvedValue({ valid: true });
    const readShotPlan = vi.fn();
    const handler = shotPlanCommandHandlers.find(
      (candidate) => candidate.path.join(' ') === 'shot move'
    );
    await handler!.run({
      flags: {
        shotPlan: 'shot_plan_1',
        shot: 'shot_1',
        position: 2,
      },
      runtime: runtime({
        moveShotInPlan,
        readShotPlan,
      }),
    });
    expect(moveShotInPlan).toHaveBeenCalledWith({
      projectName: 'movie',
      homeDir: '/tmp/home',
      shotPlanId: 'shot_plan_1',
      shotId: 'shot_1',
      position: 1,
    });
    expect(readShotPlan).not.toHaveBeenCalled();
  });

  it('validates a document without calling a mutation', async () => {
    const validateShotPlanDocument = vi.fn().mockResolvedValue({
      valid: true,
      document: {
        kind: 'shot',
        title: 'Detail',
        description: 'Exact prose.',
        brief: {},
      },
      warnings: [],
    });
    const createShotPlan = vi.fn();
    const handler = shotPlanCommandHandlers.find(
      (candidate) => candidate.path.join(' ') === 'validate'
    );
    await handler!.run({
      flags: { file: new URL('../../test-fixtures/shot.json', import.meta.url).pathname },
      runtime: runtime({
        validateShotPlanDocument,
        createShotPlan,
      }),
    });
    expect(validateShotPlanDocument).toHaveBeenCalledOnce();
    expect(createShotPlan).not.toHaveBeenCalled();
  });
});

function runtime(methods: Record<string, unknown>) {
  return {
    projectName: 'movie',
    homeDir: '/tmp/home',
    json: true,
    io: {
      stdout: { log: vi.fn() },
      stderr: { error: vi.fn() },
    },
    projectDataService: methods as unknown as ProjectDataService,
  };
}
