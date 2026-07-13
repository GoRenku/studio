// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SceneShotVideoTakeDirection } from '@gorenku/studio-core/client';
import {
  createShotVideoTakeReferenceSelectionFixture,
  createShotVideoTakeStateE2eFixture,
  readPersistedShotVideoTake,
  updateShotVideoTakeGrouping,
  type ShotVideoTakeStateE2eFixture,
} from './testing/shot-video-take-state-e2e.test-fixture';
import {
  estimateShotVideoTakeGeneration,
  readShotVideoTakeWorkspace,
  setShotVideoTakeDirection,
  setShotVideoTakeGenerationReference,
  setShotVideoTakeGenerationSpec,
  setShotVideoTakeStructure,
} from './studio-shot-video-takes-api';

const DIRECTIONS: Array<{
  name: string;
  direction: SceneShotVideoTakeDirection;
}> = [
  {
    name: 'composition choices',
    direction: {
      composition: {
        shotSize: 'close-up',
        subjectFraming: ['single', 'over-the-shoulder'],
        cameraAngle: 'low-angle',
        dutch: 'left',
        lens: {
          type: 'normal',
          millimeters: 50,
          focus: 'shallow-focus',
        },
        customComposition: 'Keep the cannon crew compressed against the wall.',
      },
    },
  },
  {
    name: 'motion choices',
    direction: {
      motion: {
        movement: 'push-in',
        secondary: 'rack-focus',
        directions: ['forward', 'up'],
        track: 'straight',
        rig: 'dolly',
        customMotion: 'Begin locked, then creep toward the gate.',
      },
    },
  },
];

describe('current Shot Video Take state persistence e2e', () => {
  let fixture: ShotVideoTakeStateE2eFixture;

  beforeAll(async () => {
    fixture = await createShotVideoTakeStateE2eFixture();
    await createShotVideoTakeReferenceSelectionFixture(fixture);
  });

  afterAll(() => {
    fixture.restoreFetch();
  });

  it.each(DIRECTIONS)(
    'persists $name independently from generation state',
    async ({ direction }) => {
      const take = await fixture.createTake({
        shotIds: ['shot_001'],
        title: 'Gate pressure take',
      });

      const saved = await setShotVideoTakeDirection(
        fixture.projectName,
        fixture.ids.sceneId,
        take.takeId,
        direction
      );
      expect(saved.workspace.take.state).toEqual({
        version: 3,
        structure: { mode: 'continuous', sharedDirection: direction },
      });

      await updateShotVideoTakeGrouping(fixture, take.takeId, [
        'shot_001',
        'shot_002',
      ]);
      const reloaded = await readPersistedShotVideoTake(fixture, take.takeId);
      expect(reloaded.shotIds).toEqual(['shot_001', 'shot_002']);
      expect(reloaded.state.structure).toEqual({
        mode: 'continuous',
        sharedDirection: direction,
      });
      expect(reloaded.state).not.toHaveProperty('production');
    }
  );

  it('persists continuous and multi-cut structure through focused commands', async () => {
    const take = await fixture.createTake({
      shotIds: ['shot_001', 'shot_002'],
      title: 'Multi-cut take',
    });

    await setShotVideoTakeStructure(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId,
      'multi-cut'
    );
    await setShotVideoTakeDirection(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId,
      { composition: { shotSize: 'wide-shot' } },
      'shot_001'
    );
    const workspace = await readShotVideoTakeWorkspace(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId
    );
    expect(workspace.take.state).toMatchObject({
      version: 3,
      structure: {
        mode: 'multi-cut',
        directionsByShotId: {
          shot_001: { composition: { shotSize: 'wide-shot' } },
        },
      },
    });

    await setShotVideoTakeStructure(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId,
      'continuous',
      'shot_001'
    );
    const reloaded = await readPersistedShotVideoTake(fixture, take.takeId);
    expect(reloaded.state.structure).toEqual({
      mode: 'continuous',
      sharedDirection: { composition: { shotSize: 'wide-shot' } },
    });
  });

  it('persists generation setup and exact references in the generic spec only', async () => {
    const take = await fixture.createTake({
      shotIds: ['shot_001'],
      title: 'Reference take',
    });
    const initial = await readShotVideoTakeWorkspace(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId
    );
    const model = initial.generation.models.find((candidate) =>
      candidate.supportedInputModes.includes('reference')
    ) ?? initial.generation.models[0]!;
    const setup = {
      inputModeId: model.supportedInputModes[0]!,
      modelChoice: model.modelChoice,
      parameterValues: {},
    };

    await setShotVideoTakeGenerationSpec(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId,
      setup
    );
    const withSpec = await readShotVideoTakeWorkspace(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId
    );
    const reference = [
      ...withSpec.generation.references.general,
      ...withSpec.generation.references.lookbook,
      ...withSpec.generation.references.castMembers.flatMap(
        (member) => member.characterSheets
      ),
      ...withSpec.generation.references.locations.flatMap(
        (location) => location.environmentSheets
      ),
    ][0];
    if (reference) {
      await setShotVideoTakeGenerationReference(
        fixture.projectName,
        fixture.ids.sceneId,
        take.takeId,
        { selectionId: reference.card.selectionId, included: true }
      );
    }

    const reloaded = await readShotVideoTakeWorkspace(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId
    );
    expect(reloaded.generation.spec?.spec.model).toEqual({
      provider: model.provider,
      model: model.model,
    });
    expect(reloaded.take.state).not.toHaveProperty('production');
    expect(reloaded.take.state.structure).not.toHaveProperty(
      'referenceSelections'
    );
    if (reference) {
      expect(
        reloaded.generation.spec?.spec.references.some(
          (selection) =>
            selection.id === reference.card.selectionId && selection.included
        )
      ).toBe(true);
    }
  });

  it('estimates an unsaved current setup without creating a durable spec', async () => {
    const take = await fixture.createTake({
      shotIds: ['shot_001'],
      title: 'Estimate-only take',
    });
    const workspace = await readShotVideoTakeWorkspace(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId
    );
    const model = workspace.generation.models[0]!;

    const report = await estimateShotVideoTakeGeneration(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId,
      {
        inputModeId: model.supportedInputModes[0]!,
        modelChoice: model.modelChoice,
        parameterValues: {},
      }
    );
    expect(report.valid).toBe(true);

    const reloaded = await readShotVideoTakeWorkspace(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId
    );
    expect(reloaded.generation.spec).toBeNull();
  });
});
