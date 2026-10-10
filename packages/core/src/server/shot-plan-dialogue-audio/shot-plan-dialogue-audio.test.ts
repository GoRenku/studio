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

  it('stores independent Turn ranges and selects each newly attached Take', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const plan = await createDialogueShotPlan(projectData, homeDir, 'Dialogue coverage');
    await writeMediaFiles(created.projectPath, ['turn-1.mp3', 'turns-2-3.mp3']);

    const second = await attachTake(projectData, homeDir, {
      shotPlanId: plan.shotPlan.id,
      source: 'tmp/media/turns-2-3.mp3',
      turnRange: { start: 2, end: 3 },
      generationProvenance: {
        ...provenance,
        model: 'provider/model-multi-speaker',
        receipt: { requestId: 'request_2' },
      },
    });
    const first = await attachTake(projectData, homeDir, {
      shotPlanId: plan.shotPlan.id,
      source: 'tmp/media/turn-1.mp3',
      turnRange: { start: 1, end: 1 },
    });
    expect(first.assetFile?.projectRelativePath).toMatch(
      /^scenes\/[^/]+\/01-shot-plan\/dialogues\/turn-01-g[a-z0-9]+\.mp3$/
    );
    expect(second.assetFile?.projectRelativePath).toMatch(
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
        selected: true,
        assetFile: expect.objectContaining({ generationProvenance: provenance }),
      }),
      expect.objectContaining({ turnRange: { start: 2, end: 3 }, selected: true }),
    ]);
    expect(initial.resourceKeys).toContain(
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
        assetFileId: first.assetFile.id,
        dialogueTurnRange: { start: 1, end: 1 },
        isWorkflowSelected: true,
      }),
      expect.objectContaining({
        assetFileId: second.assetFile.id,
        dialogueTurnRange: { start: 2, end: 3 },
        isWorkflowSelected: true,
      }),
    ]));
  });

  it('clears overlapping selected Takes but not adjacent ones when a Take is attached', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const plan = await createDialogueShotPlan(projectData, homeDir, 'Dialogue coverage');
    await writeMediaFiles(created.projectPath, ['turn-1.mp3', 'turns-2-3.mp3', 'turn-3.mp3']);

    const turnOne = await attachTake(projectData, homeDir, {
      shotPlanId: plan.shotPlan.id,
      source: 'tmp/media/turn-1.mp3',
      turnRange: { start: 1, end: 1 },
    });
    const turnsTwoThree = await attachTake(projectData, homeDir, {
      shotPlanId: plan.shotPlan.id,
      source: 'tmp/media/turns-2-3.mp3',
      turnRange: { start: 2, end: 3 },
    });
    const turnThree = await attachTake(projectData, homeDir, {
      shotPlanId: plan.shotPlan.id,
      source: 'tmp/media/turn-3.mp3',
      turnRange: { start: 3, end: 3 },
    });

    expect(selectionByAssetFile(turnThree.resource)).toEqual({
      [turnOne.assetFile.id]: true,
      [turnsTwoThree.assetFile.id]: false,
      [turnThree.assetFile.id]: true,
    });
  });

  it('clears overlapping selections only in the same Shot Plan when a Take is selected', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const plan = await createDialogueShotPlan(projectData, homeDir, 'Dialogue coverage');
    const otherPlan = await createDialogueShotPlan(projectData, homeDir, 'Alternate coverage');
    await writeMediaFiles(created.projectPath, [
      'turns-1-2.mp3',
      'turn-2.mp3',
      'turn-3.mp3',
      'other-turn-2.mp3',
    ]);

    const turnsOneTwo = await attachTake(projectData, homeDir, {
      shotPlanId: plan.shotPlan.id,
      source: 'tmp/media/turns-1-2.mp3',
      turnRange: { start: 1, end: 2 },
    });
    const turnTwo = await attachTake(projectData, homeDir, {
      shotPlanId: plan.shotPlan.id,
      source: 'tmp/media/turn-2.mp3',
      turnRange: { start: 2, end: 2 },
    });
    const turnThree = await attachTake(projectData, homeDir, {
      shotPlanId: plan.shotPlan.id,
      source: 'tmp/media/turn-3.mp3',
      turnRange: { start: 3, end: 3 },
    });
    const otherTurnTwo = await attachTake(projectData, homeDir, {
      shotPlanId: otherPlan.shotPlan.id,
      source: 'tmp/media/other-turn-2.mp3',
      turnRange: { start: 2, end: 2 },
    });

    const selected = await projectData.selectShotPlanDialogueAudioTake({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
      takeId: takeIdForAssetFile(turnThree.resource, turnsOneTwo.assetFile.id),
    });

    expect(selectionByAssetFile(selected.resource)).toEqual({
      [turnsOneTwo.assetFile.id]: true,
      [turnTwo.assetFile.id]: false,
      [turnThree.assetFile.id]: true,
    });
    const other = await projectData.readShotPlanDialogueAudio({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: otherPlan.shotPlan.id,
    });
    expect(selectionByAssetFile(other)).toEqual({ [otherTurnTwo.assetFile.id]: true });

    const cleared = await projectData.clearShotPlanDialogueAudioTakeSelection({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
      takeId: takeIdForAssetFile(selected.resource, turnsOneTwo.assetFile.id),
    });
    expect(selectionByAssetFile(cleared.resource)).toEqual({
      [turnsOneTwo.assetFile.id]: false,
      [turnTwo.assetFile.id]: false,
      [turnThree.assetFile.id]: true,
    });
  });

  it('leaves lines unselected after discard and restores Takes unselected', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const plan = await createDialogueShotPlan(projectData, homeDir, 'Dialogue coverage');
    await writeMediaFiles(created.projectPath, ['turn-1-first.mp3', 'turn-1-second.mp3']);

    const earlier = await attachTake(projectData, homeDir, {
      shotPlanId: plan.shotPlan.id,
      source: 'tmp/media/turn-1-first.mp3',
      turnRange: { start: 1, end: 1 },
    });
    const later = await attachTake(projectData, homeDir, {
      shotPlanId: plan.shotPlan.id,
      source: 'tmp/media/turn-1-second.mp3',
      turnRange: { start: 1, end: 1 },
    });
    const discarded = await projectData.discardShotPlanDialogueAudioTake({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
      takeId: takeIdForAssetFile(later.resource, later.assetFile.id),
    });

    expect(selectionByAssetFile(discarded.resource)).toEqual({
      [earlier.assetFile.id]: false,
    });
    const recoveryId = discarded.recovery?.restoreCommand.trashItemId;
    if (!recoveryId) {
      throw new Error('Expected a recoverable Trash item.');
    }
    await projectData.restoreTrashItem({
      projectName: 'constantinople',
      homeDir,
      trashItemId: recoveryId,
    });
    const restored = await projectData.readShotPlanDialogueAudio({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
    });
    expect(selectionByAssetFile(restored)).toEqual({
      [earlier.assetFile.id]: false,
      [later.assetFile.id]: false,
    });
  });

  it('projects current screenplay lines covered by active Takes', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const screenplay = await projectData.readScreenplayStructure({
      projectName: 'constantinople',
      homeDir,
    });
    const scene = screenplay.screenplay.scenes[0];
    if (!scene) {
      throw new Error('Expected a Scene fixture.');
    }
    await projectData.applyScreenplayOperations({
      projectName: 'constantinople',
      homeDir,
      operations: [{
        operation: 'scene.update',
        scene: {
          id: scene.id,
          heading: scene.heading,
          title: scene.title,
          blocks: [
            ...scene.blocks,
            {
              key: 'mehmed-line',
              type: 'dialogue',
              characterName: 'MEHMED',
              extensions: [],
              parts: [{ key: 'mehmed-speech', type: 'speech', text: 'The walls will fall.' }],
            },
            {
              key: 'halil-line',
              type: 'dialogue',
              characterName: 'HALIL',
              extensions: [],
              parts: [{ key: 'halil-speech', type: 'speech', text: 'Not this spring.' }],
            },
            {
              key: 'unused-line',
              type: 'dialogue',
              characterName: 'MEHMED',
              extensions: [],
              parts: [{ key: 'unused-speech', type: 'speech', text: 'Then by summer.' }],
            },
          ],
        },
      }],
    });
    const plan = await createDialogueShotPlan(projectData, homeDir, 'Dialogue coverage');
    await writeMediaFiles(created.projectPath, ['turns-1-2.mp3', 'missing-turn.mp3']);

    await attachTake(projectData, homeDir, {
      shotPlanId: plan.shotPlan.id,
      source: 'tmp/media/turns-1-2.mp3',
      turnRange: { start: 1, end: 2 },
    });
    const attached = await attachTake(projectData, homeDir, {
      shotPlanId: plan.shotPlan.id,
      source: 'tmp/media/missing-turn.mp3',
      turnRange: { start: 900, end: 900 },
    });

    expect(attached.resource.lines).toEqual([
      { number: 1, speakerName: 'MEHMED', castMemberId: null, plainText: 'The walls will fall.' },
      { number: 2, speakerName: 'HALIL', castMemberId: null, plainText: 'Not this spring.' },
    ]);
  });
});

const provenance = {
  provider: 'provider-owned',
  model: 'provider/model-audio',
  mediaKind: 'audio' as const,
  prompt: 'Exact screenplay dialogue.',
  request: { nativeProviderField: { preserved: true } },
  receipt: { requestId: 'request_1' },
};

type ProjectData = ReturnType<typeof createProjectDataService>;
type DialogueAudioResource = Awaited<ReturnType<ProjectData['readShotPlanDialogueAudio']>>;

async function createDialogueShotPlan(
  projectData: ProjectData,
  homeDir: string,
  title: string,
) {
  const screenplay = await projectData.readScreenplayStructure({
    projectName: 'constantinople',
    homeDir,
  });
  const sceneId = screenplay.screenplay.scenes[0]?.id;
  if (!sceneId) {
    throw new Error('Expected a Scene fixture.');
  }
  return await projectData.createShotPlan({
    type: 'shot-list',
    projectName: 'constantinople',
    homeDir,
    sceneId,
    title,
    coverage: null,
    shots: [{ title: 'Held exchange', description: 'Hold the exchange.', brief: {} }],
  });
}

async function writeMediaFiles(projectPath: string, fileNames: string[]): Promise<void> {
  await fs.mkdir(path.join(projectPath, 'tmp', 'media'), { recursive: true });
  for (const fileName of fileNames) {
    await fs.writeFile(path.join(projectPath, 'tmp', 'media', fileName), fileName);
  }
}

async function attachTake(
  projectData: ProjectData,
  homeDir: string,
  input: {
    shotPlanId: string;
    source: string;
    turnRange: { start: number; end: number };
    generationProvenance?: typeof provenance;
  },
) {
  const attached = await projectData.attachGenerationMedia({
    projectName: 'constantinople',
    homeDir,
    purpose: 'shot-plan.dialogue-audio',
    target: { kind: 'shotPlan', id: input.shotPlanId },
    sourceProjectRelativePath: input.source,
    turnRange: input.turnRange,
    generationProvenance: input.generationProvenance ?? provenance,
  });
  const resource = await projectData.readShotPlanDialogueAudio({
    projectName: 'constantinople',
    homeDir,
    shotPlanId: input.shotPlanId,
  });
  return { assetFile: attached.assetFile, resource };
}

function selectionByAssetFile(resource: DialogueAudioResource): Record<string, boolean> {
  return Object.fromEntries(
    resource.takes.map((take) => [take.assetFile.id, take.selected]),
  );
}

function takeIdForAssetFile(
  resource: DialogueAudioResource,
  assetFileId: string,
): string {
  const take = resource.takes.find((candidate) => candidate.assetFile.id === assetFileId);
  if (!take) {
    throw new Error(`Expected a Take for Asset ${assetFileId}.`);
  }
  return take.id;
}
