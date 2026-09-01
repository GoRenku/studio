import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProjectDataService } from '../project-data-service.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';

describe('Shot Plan Dialogue Audio', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-shot-plan-audio-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
  });

  it('stores independent Turn ranges and supports exact multi-selection', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const screenplay = await projectData.readScreenplayStructure({
      projectName: 'constantinople',
      homeDir,
    });
    const sceneId = screenplay.screenplay.scenes[0]?.id;
    if (!sceneId) {
      throw new Error('Expected a Scene fixture.');
    }
    const plan = await projectData.createShotPlan({
      projectName: 'constantinople',
      homeDir,
      sceneId,
      title: 'Dialogue coverage',
      coverage: null,
      shots: [{ title: 'Held exchange', description: 'Hold the exchange.', brief: {} }],
    });
    await fs.mkdir(path.join(created.projectPath, 'tmp', 'media'), { recursive: true });
    await fs.writeFile(path.join(created.projectPath, 'tmp', 'media', 'turn-1.mp3'), 'turn 1');
    await fs.writeFile(path.join(created.projectPath, 'tmp', 'media', 'turns-2-3.mp3'), 'turns 2-3');

    const provenance = {
      provider: 'provider-owned',
      model: 'provider/model-audio',
      mediaKind: 'audio' as const,
      prompt: 'Exact screenplay dialogue.',
      request: { nativeProviderField: { preserved: true } },
      receipt: { requestId: 'request_1' },
    };
    const second = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'shot-plan.dialogue-audio',
      target: { kind: 'shotPlan', id: plan.shotPlan.id },
      sourceProjectRelativePath: 'tmp/media/turns-2-3.mp3',
      turnRange: { start: 2, end: 3 },
      generationProvenance: {
        ...provenance,
        model: 'provider/model-multi-speaker',
        receipt: { requestId: 'request_2' },
      },
    });
    const first = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'shot-plan.dialogue-audio',
      target: { kind: 'shotPlan', id: plan.shotPlan.id },
      sourceProjectRelativePath: 'tmp/media/turn-1.mp3',
      turnRange: { start: 1, end: 1 },
      generationProvenance: provenance,
    });
    expect(first.asset.files[0]?.projectRelativePath).toMatch(
      /^scenes\/[^/]+\/01-shot-plan\/dialogues\/turn-01-g[a-z0-9]+\.mp3$/
    );
    expect(second.asset.files[0]?.projectRelativePath).toMatch(
      /^scenes\/[^/]+\/01-shot-plan\/dialogues\/turns-02-03-g[a-z0-9]+\.mp3$/
    );
    const initial = await projectData.readShotPlanDialogueAudio({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
    });
    expect(initial.takes).toEqual([
      expect.objectContaining({
        turnRange: { start: 1, end: 1 },
        selected: false,
        asset: expect.objectContaining({ generationProvenance: provenance }),
      }),
      expect.objectContaining({ turnRange: { start: 2, end: 3 }, selected: false }),
    ]);

    await projectData.selectShotPlanDialogueAudioTake({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
      takeId: takeIdForAsset(initial, first.asset.id),
    });
    const selected = await projectData.selectShotPlanDialogueAudioTake({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
      takeId: takeIdForAsset(initial, second.asset.id),
    });

    expect(selected.resource.takes.map((take) => ({
      range: take.turnRange,
      selected: take.selected,
    }))).toEqual([
      { range: { start: 1, end: 1 }, selected: true },
      { range: { start: 2, end: 3 }, selected: true },
    ]);
    expect(selected.resourceKeys).toContain(
      `surface:shotPlan:${plan.shotPlan.id}:dialogue-audio`,
    );

    const videoContext = await projectData.readMediaGenerationContext({
      projectName: 'constantinople',
      homeDir,
      purpose: 'shot-plan.video-generation',
      target: { kind: 'shotPlan', id: plan.shotPlan.id },
    });
    const dialogueAudio = videoContext.suggestedReferences.find(
      (suggestion) => suggestion.role === 'dialogue-audio'
    );
    expect(dialogueAudio?.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        assetId: first.asset.id,
        dialogueTurnRange: { start: 1, end: 1 },
        isWorkflowSelected: true,
      }),
      expect.objectContaining({
        assetId: second.asset.id,
        dialogueTurnRange: { start: 2, end: 3 },
        isWorkflowSelected: true,
      }),
    ]));
  });
});

function takeIdForAsset(
  resource: Awaited<ReturnType<ReturnType<typeof createProjectDataService>['readShotPlanDialogueAudio']>>,
  assetId: string,
): string {
  const take = resource.takes.find((candidate) => candidate.asset.id === assetId);
  if (!take) {
    throw new Error(`Expected a Take for Asset ${assetId}.`);
  }
  return take.id;
}
