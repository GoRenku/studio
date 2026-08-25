import { describe, expect, it } from 'vitest';
import { parseStudioSelection } from './selection-validation.js';

describe('Studio selection validation', () => {
  it('reads complete nested Shot Plan selection state', () => {
    expect(
      parseStudioSelection({
        type: 'scene',
        id: 'scene_opening',
        sceneTab: 'shotPlans',
        shotPlanId: 'plan_primary',
        shotId: 'shot_wide',
      })
    ).toEqual({
      valid: true,
      selection: {
        type: 'scene',
        id: 'scene_opening',
        sceneTab: 'shotPlans',
        shotPlanId: 'plan_primary',
        shotId: 'shot_wide',
      },
    });
  });

  it.each([
    ['a number', 123],
    ['a blank string', '   '],
    ['an array', ['plan_primary']],
    ['an object', { id: 'plan_primary' }],
  ])('rejects shotPlanId when it is %s', (_label, shotPlanId) => {
    const result = parseStudioSelection({
      type: 'scene',
      id: 'scene_opening',
      sceneTab: 'shotPlans',
      shotPlanId,
    });

    expect(result).toMatchObject({
      valid: false,
      issues: [
        {
          code: 'STUDIO_COORDINATION005',
          location: { path: ['shotPlanId'] },
        },
      ],
    });
  });

  it('enforces nested Scene selection relationships structurally', () => {
    expect(
      parseStudioSelection({
        type: 'scene',
        id: 'scene_opening',
        sceneTab: 'narrative',
        shotPlanId: 'plan_primary',
      })
    ).toMatchObject({
      valid: false,
      issues: [{ code: 'STUDIO_COORDINATION039' }],
    });
    expect(
      parseStudioSelection({
        type: 'scene',
        id: 'scene_opening',
        sceneTab: 'shotPlans',
        shotId: 'shot_wide',
      })
    ).toMatchObject({
      valid: false,
      issues: [{ code: 'STUDIO_COORDINATION040' }],
    });
    expect(parseStudioSelection({
      type: 'scene',
      id: 'scene_opening',
      sceneTab: 'shotPlans',
      shotPlanId: 'plan_primary',
      shotPlanTab: 'assets',
      shotId: 'shot_wide',
    })).toMatchObject({
      valid: false,
      issues: [{ code: 'STUDIO_COORDINATION040', location: { path: ['shotId'] } }],
    });
  });

  it('accepts the exact Shot Plan Assets selection and rejects unknown detail tabs', () => {
    expect(parseStudioSelection({
      type: 'scene',
      id: 'scene_opening',
      sceneTab: 'shotPlans',
      shotPlanId: 'plan_primary',
      shotPlanTab: 'assets',
    })).toEqual({
      valid: true,
      selection: {
        type: 'scene',
        id: 'scene_opening',
        sceneTab: 'shotPlans',
        shotPlanId: 'plan_primary',
        shotPlanTab: 'assets',
      },
    });
    expect(parseStudioSelection({
      type: 'scene',
      id: 'scene_opening',
      sceneTab: 'shotPlans',
      shotPlanId: 'plan_primary',
      shotPlanTab: 'unknown',
    })).toMatchObject({ valid: false, issues: [{ code: 'STUDIO_COORDINATION005' }] });
  });
});
