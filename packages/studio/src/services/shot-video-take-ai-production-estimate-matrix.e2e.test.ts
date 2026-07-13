// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createShotVideoTakeReferenceSelectionFixture,
  createShotVideoTakeStateE2eFixture,
  type ShotVideoTakeStateE2eFixture,
} from './testing/shot-video-take-state-e2e.test-fixture';
import {
  estimateShotVideoTakeGeneration,
  readShotVideoTakeWorkspace,
  setShotVideoTakeGenerationSpec,
} from './studio-shot-video-takes-api';

describe('Shot Video Take model estimate matrix e2e', () => {
  let fixture: ShotVideoTakeStateE2eFixture;

  beforeAll(async () => {
    fixture = await createShotVideoTakeStateE2eFixture();
    await createShotVideoTakeReferenceSelectionFixture(fixture);
  });

  afterAll(() => {
    fixture.restoreFetch();
  });

  it('derives every input mode and duration from Engines model metadata', async () => {
    const take = await fixture.createTake({
      shotIds: ['shot_001'],
      title: 'Model matrix take',
    });
    const workspace = await readShotVideoTakeWorkspace(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId
    );

    expect(workspace.generation.models.length).toBeGreaterThan(0);
    for (const model of workspace.generation.models) {
      expect(model.provider).toBeTruthy();
      expect(model.model).toBeTruthy();
      expect(model.supportedInputModes.length).toBeGreaterThan(0);
      expect(model).not.toHaveProperty('available');
      expect(model).not.toHaveProperty('status');
      expect(model).not.toHaveProperty('estimateInputs');
      expect(typeof model.duration.supported).toBe('boolean');
      expect(
        model.duration.values?.every((value) => typeof value === 'number') ?? true
      ).toBe(true);
      const duration = model.parameters.find(
        (parameter) => parameter.name === 'duration'
      );
      if (duration) {
        expect(duration.allowedValues ?? []).not.toContain('auto');
        expect(duration.defaultValue).not.toBe('auto');
        if (duration.allowedValues?.length) {
          expect(Number(duration.defaultValue)).toBe(
            Math.min(...duration.allowedValues.map(Number))
          );
        } else if (duration.minimum !== undefined) {
          expect(duration.defaultValue).toBe(duration.minimum);
        }
      }
    }
    const activeModel = workspace.generation.models.find(
      (model) => model.modelChoice === workspace.generation.setup.modelChoice
    );
    const activeDuration = activeModel?.parameters.find(
      (parameter) => parameter.name === 'duration'
    );
    if (activeDuration) {
      expect(workspace.generation.setup.parameterValues.duration).toBe(
        activeDuration.defaultValue
      );
    }
  });

  it('estimates Seedance 2.0 at five seconds without prompt or dependency inputs', async () => {
    const take = await fixture.createTake({
      shotIds: ['shot_001'],
      title: 'Direct estimate take',
    });
    const workspace = await readShotVideoTakeWorkspace(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId
    );
    const model = workspace.generation.models.find(
      (candidate) =>
        candidate.provider === 'fal-ai' &&
        candidate.model === 'bytedance/seedance-2.0/image-to-video'
    );
    expect(model).toBeTruthy();
    if (!model) return;
    const report = await estimateShotVideoTakeGeneration(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId,
      {
        inputModeId: model.supportedInputModes[0]!,
        modelChoice: model.modelChoice,
        parameterValues: {
          duration: '5',
          resolution: '720p',
          aspect_ratio: '16:9',
        },
      }
    );

    expect(report).not.toHaveProperty('plan');
    expect(report).not.toHaveProperty('dependencies');
    expect(report).not.toHaveProperty('estimatedTotalUsd');
    expect(report.valid).toBe(true);
    if (report.valid) {
      expect(report.estimate.estimatedCostUsd).toBeCloseTo(1.512, 5);
      expect(report.estimate.billableUnits).toMatchObject({
        duration: '5',
        resolution: '720p',
        aspect_ratio: '16:9',
      });
      expect(report.estimate).not.toHaveProperty('approvalToken');
    }
  });

  it('provides a model-only estimate for every model shown in AI Production', async () => {
    const take = await fixture.createTake({
      shotIds: ['shot_001'],
      title: 'Every model estimate take',
    });
    const workspace = await readShotVideoTakeWorkspace(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId
    );
    const reports = await Promise.all(
      workspace.generation.models.map(async (model) => ({
        model,
        report: await estimateShotVideoTakeGeneration(
          fixture.projectName,
          fixture.ids.sceneId,
          take.takeId,
          {
            inputModeId: model.supportedInputModes[0]!,
            modelChoice: model.modelChoice,
            parameterValues: Object.fromEntries(
              model.parameters.flatMap((parameter) =>
                parameter.defaultValue === undefined
                  ? []
                  : [[parameter.name, parameter.defaultValue]]
              )
            ),
          }
        ),
      }))
    );
    const failures = reports.flatMap(({ model, report }) =>
      report.valid
        ? []
        : [`${model.label}: ${report.diagnostics.map((issue) => issue.message).join('; ')}`]
    );

    expect(failures).toEqual([]);
  }, 30_000);

  it('keeps candidate and guide projections free of price fields', async () => {
    const take = await fixture.createTake({
      shotIds: ['shot_001'],
      title: 'Reference matrix take',
    });
    const workspace = await readShotVideoTakeWorkspace(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId
    );
    const serialized = JSON.stringify({
      guide: workspace.generation.context.referenceGuide,
      references: workspace.generation.references,
      models: workspace.generation.models,
    });

    expect(serialized).not.toContain('estimatedCostUsd');
    expect(serialized).not.toContain('estimatedTotalUsd');
    expect(serialized).not.toContain('pricing');
  });

  it('stores authored setup in the generic spec and not take state', async () => {
    const take = await fixture.createTake({
      shotIds: ['shot_001'],
      title: 'Generic spec take',
    });
    const workspace = await readShotVideoTakeWorkspace(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId
    );
    const model = workspace.generation.models[0]!;

    await setShotVideoTakeGenerationSpec(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId,
      {
        inputModeId: model.supportedInputModes[0]!,
        modelChoice: model.modelChoice,
        parameterValues: {},
      }
    );
    const reloaded = await readShotVideoTakeWorkspace(
      fixture.projectName,
      fixture.ids.sceneId,
      take.takeId
    );

    expect(reloaded.generation.spec?.spec.target).toEqual({
      kind: 'sceneShotVideoTake',
      id: take.takeId,
    });
    expect(reloaded.take.state).toEqual({
      version: 3,
      structure: {
        mode: 'continuous',
        sharedDirection: {},
      },
    });
  });
});
