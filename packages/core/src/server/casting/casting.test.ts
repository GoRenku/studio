import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CastingRoundSubject } from '../../client/casting/model.js';
import { createProjectDataService } from '../project-data-service.js';
import { openCurrentProject } from '../project-selection/index.js';
import { createSampleMovieProject, writeConfig } from '../testing/project-data-fixtures.js';

const MEHMED = 'cast_test0002';
const project = { projectName: 'constantinople' };

describe('casting', () => {
  let homeDir: string;
  let projectFolder: string;
  let sceneIds: string[];
  let projectData = createProjectDataService();

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-casting-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    projectData = createProjectDataService();
    const created = await createSampleMovieProject({ homeDir, projectData });
    if (!created) {
      throw new Error('Expected a sample Project.');
    }
    projectFolder = created.projectPath;
    await openCurrentProject({ projectName: 'constantinople', homeDir });
    await projectData.applyScreenplayOperations({
      ...project,
      homeDir,
      operations: [{
        operation: 'scene.add',
        scene: { key: 'harbor', heading: 'EXT. HARBOR - DAY', blocks: [] },
        structureEntryKey: 'harbor-entry',
        placement: { at: 'end' },
      }],
    });
    const screenplay = await projectData.readScreenplayStructure({ ...project, homeDir });
    sceneIds = screenplay.screenplay.scenes.map((scene) => scene.id);
    await fs.mkdir(path.join(projectFolder, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(projectFolder, 'tmp', 'image.png'), 'image');
  });

  async function writeTwoLooks() {
    const report = await projectData.writeCastLooksPlan({
      homeDir,
      document: {
        kind: 'castLooksPlan',
        castMemberId: MEHMED,
        looks: [
          { name: 'Young', description: 'About 19.', sceneIds: [sceneIds[1]!] },
          { name: 'Older', sceneIds: [sceneIds[0]!] },
        ],
      },
    });
    return { young: report.looks[0]!, older: report.looks[1]! };
  }

  async function createRound(subject: CastingRoundSubject, referenceAssetFileIds: string[] = []) {
    return (await projectData.createCastingRound({
      homeDir,
      document: {
        kind: 'castingRoundCreate',
        subject,
        routes: [
          { provider: 'fal-ai', model: { key: 'model-a', name: 'Model A' }, count: 2 },
          { provider: 'fal-ai', model: { key: 'model-b', name: 'Model B' }, count: 1 },
        ],
        maxConcurrentGenerations: 3,
        referenceAssetFileIds,
        estimatedCost: { amount: 0.12, currency: 'USD' },
      },
    })).round;
  }

  const lookSubject = (id: string): CastingRoundSubject => ({ kind: 'castLook', id });
  const costumeSubject = (id: string): CastingRoundSubject => ({ kind: 'castCostume', id });

  function importSheet(roundId: string, select?: boolean) {
    return projectData.attachGenerationMedia({
      homeDir,
      purpose: 'cast.character-sheet',
      target: { kind: 'castingRound', id: roundId },
      sourceProjectRelativePath: 'tmp/image.png',
      castingModelKey: 'model-a',
      ...(select ? { select } : {}),
    });
  }

  function importCandidate(roundId: string, castingModelKey = 'model-a') {
    return projectData.attachGenerationMedia({
      homeDir,
      purpose: 'cast.casting-candidate',
      target: { kind: 'castingRound', id: roundId },
      sourceProjectRelativePath: 'tmp/image.png',
      castingModelKey,
    });
  }

  it('writes Looks in screenplay order and keeps ids on rewrite', async () => {
    const { young, older } = await writeTwoLooks();
    expect(young).toMatchObject({ name: 'Young', description: 'About 19.', sceneIds: [sceneIds[1]], castCandidateAssetFileId: null });
    const renamed = await projectData.writeCastLooksPlan({
      homeDir,
      document: {
        kind: 'castLooksPlan',
        castMemberId: MEHMED,
        looks: [
          { id: older.id, name: 'Young', sceneIds: [sceneIds[0]!] },
          { id: young.id, name: 'Older', sceneIds: [sceneIds[1]!] },
        ],
      },
    });
    expect(renamed.looks.map((look) => [look.id, look.name])).toEqual([[older.id, 'Young'], [young.id, 'Older']]);
    expect(renamed.resourceKeys).toContain(`surface:castMember:${MEHMED}`);
  });

  it('collects every Looks plan issue before writing', async () => {
    await expect(projectData.writeCastLooksPlan({
      homeDir,
      document: {
        kind: 'castLooksPlan',
        castMemberId: MEHMED,
        looks: [
          { name: 'Young', sceneIds: [sceneIds[0]!, 'scene_missing'] },
          { name: 'young', sceneIds: [sceneIds[0]!] },
        ],
      },
    })).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({ code: 'CASTING_DUPLICATE_NAME' }),
        expect.objectContaining({ code: 'CASTING_UNKNOWN_SCENE' }),
        expect.objectContaining({ code: 'CASTING_LOOK_SCENE_CONFLICT' }),
      ]),
    });
    expect((await projectData.showCastLooks({ homeDir, castMemberId: MEHMED })).looks).toEqual([]);
  });

  it('keeps costumes inside their Look and one costume per scene', async () => {
    const { young, older } = await writeTwoLooks();
    await expect(projectData.writeCastWardrobePlan({
      homeDir,
      document: {
        kind: 'castWardrobePlan',
        castMemberId: MEHMED,
        costumes: [
          { name: 'Council robe', lookId: young.id, wardrobe: ['Dark robe'], continuityNotes: [], sceneIds: [sceneIds[0]!] },
          { name: 'Armour', lookId: older.id, wardrobe: ['Plate'], continuityNotes: [], sceneIds: [sceneIds[0]!] },
        ],
      },
    })).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({ code: 'CASTING_COSTUME_SCENE_OUTSIDE_LOOK' }),
        expect.objectContaining({ code: 'CASTING_COSTUME_SCENE_CONFLICT' }),
      ]),
    });

    const wardrobe = await projectData.writeCastWardrobePlan({
      homeDir,
      document: {
        kind: 'castWardrobePlan',
        castMemberId: MEHMED,
        costumes: [{ name: 'Armour', lookId: older.id, wardrobe: ['Plate'], continuityNotes: ['Same scar'], sceneIds: [sceneIds[0]!] }],
      },
    });
    expect(wardrobe.costumes[0]).toMatchObject({ name: 'Armour', lookId: older.id, sceneIds: [sceneIds[0]], characterSheetAssetFileId: null });

    await expect(projectData.writeCastLooksPlan({
      homeDir,
      document: { kind: 'castLooksPlan', castMemberId: MEHMED, looks: [{ id: young.id, name: 'Young', sceneIds: [] }] },
    })).rejects.toMatchObject({ issues: [expect.objectContaining({ code: 'CASTING_LOOK_IN_USE' })] });
  });

  it('records candidates of a round and casts one for its Look only', async () => {
    const { young, older } = await writeTwoLooks();
    const round = await createRound(lookSubject(young.id));
    expect(round).toMatchObject({ number: 1, subject: { kind: 'castLook', id: young.id }, maxConcurrentGenerations: 3 });
    await expect(importCandidate(round.id, 'model-z')).rejects.toMatchObject({ code: 'CASTING_CANDIDATE_MODEL_INVALID' });
    const first = await importCandidate(round.id);
    await importCandidate(round.id, 'model-b');
    expect(first.assetFile.type).toBe('casting_candidate');
    expect(first.assetFile.projectRelativePath).toMatch(/^cast\/mehmed-ii\/casting\//);

    await projectData.setCastingCandidateStatus({ homeDir, assetFileId: first.assetFile.id, status: 'hidden' });
    const look = await projectData.showCastingLook({ homeDir, lookId: young.id });
    expect(look.rounds[0]).toMatchObject({ number: 1, expectedCount: 3 });
    expect(look.rounds[0]!.candidates.map((candidate) => [candidate.status, candidate.model.name])).toEqual([
      ['hidden', 'Model A'],
      ['candidate', 'Model B'],
    ]);
    await expect(projectData.setCastingCandidateStatus({ homeDir, assetFileId: first.assetFile.id, status: 'kept' as 'hidden' }))
      .rejects.toMatchObject({ code: 'CASTING_CANDIDATE_STATUS_INVALID' });

    await expect(projectData.selectAssetFile({
      ...project, homeDir, target: { kind: 'castLook', id: older.id }, assetFileId: first.assetFile.id,
    })).rejects.toMatchObject({ code: 'CORE_ASSET_SELECTION_INVALID' });
    await projectData.selectAssetFile({ ...project, homeDir, target: { kind: 'castLook', id: young.id }, assetFileId: first.assetFile.id });

    const second = await createRound(lookSubject(older.id), [first.assetFile.id]);
    expect(second.number).toBe(1);
    const context = await projectData.readMediaGenerationContext({
      homeDir, purpose: 'cast.casting-candidate', target: { kind: 'castingRound', id: second.id },
    });
    expect(context.outputGuidance.aspectRatio?.value).toBe('4:3');
    expect(context.suggestedReferences.find((group) => group.id === 'casting-identity')?.candidates).toEqual([
      expect.objectContaining({ assetFileId: first.assetFile.id, isWorkflowSelected: true }),
    ]);

    const resource = await projectData.readCastCastingResource({ ...project, homeDir, castMemberId: MEHMED });
    expect(resource.looks[0]!.castCandidate?.id).toBe(first.assetFile.id);
  });

  it('refuses a round reference that belongs to another Cast Member', async () => {
    const { young } = await writeTwoLooks();
    const otherLooks = await projectData.writeCastLooksPlan({
      homeDir,
      document: { kind: 'castLooksPlan', castMemberId: 'cast_test0001', looks: [{ name: 'Main', sceneIds: [] }] },
    });
    const otherRound = await createRound(lookSubject(otherLooks.looks[0]!.id));
    const otherCandidate = await importCandidate(otherRound.id);
    await expect(createRound(lookSubject(young.id), [otherCandidate.assetFile.id]))
      .rejects.toMatchObject({ issues: [expect.objectContaining({ code: 'CASTING_ROUND_REFERENCE_NOT_OWNED' })] });
  });

  async function writeArmour(lookId: string) {
    const wardrobe = await projectData.writeCastWardrobePlan({
      homeDir,
      document: {
        kind: 'castWardrobePlan',
        castMemberId: MEHMED,
        costumes: [
          { name: 'Armour', lookId, wardrobe: ['Plate'], continuityNotes: [], sceneIds: [sceneIds[0]!] },
          { name: 'Robe', lookId, wardrobe: ['Dark robe'], continuityNotes: [], sceneIds: [] },
        ],
      },
    });
    return { armour: wardrobe.costumes[0]!, robe: wardrobe.costumes[1]! };
  }

  async function castLook(lookId: string) {
    const round = await createRound(lookSubject(lookId));
    const candidate = await importCandidate(round.id);
    await projectData.selectAssetFile({ ...project, homeDir, target: { kind: 'castLook', id: lookId }, assetFileId: candidate.assetFile.id });
    return candidate.assetFile.id;
  }

  it('runs character sheet rounds per costume once its Look is cast', async () => {
    const { young, older } = await writeTwoLooks();
    const { armour, robe } = await writeArmour(older.id);
    await expect(createRound(costumeSubject(armour.id))).rejects.toMatchObject({ code: 'CASTING_ROUND_LOOK_NOT_CAST' });
    const cast = await castLook(older.id);

    const round = await createRound(costumeSubject(armour.id), [cast]);
    expect(round).toMatchObject({ number: 1, subject: { kind: 'castCostume', id: armour.id } });
    expect((await createRound(costumeSubject(robe.id))).number).toBe(1);
    expect((await createRound(costumeSubject(armour.id))).number).toBe(2);

    await expect(projectData.attachGenerationMedia({
      homeDir, purpose: 'cast.casting-candidate', target: { kind: 'castingRound', id: round.id },
      sourceProjectRelativePath: 'tmp/image.png', castingModelKey: 'model-a',
    })).rejects.toMatchObject({ code: 'CORE_GENERATION_TARGET_INVALID' });
    const youngRound = await createRound(lookSubject(young.id));
    await expect(importSheet(youngRound.id)).rejects.toMatchObject({ code: 'CORE_GENERATION_TARGET_INVALID' });
    await expect(importSheet(round.id, true)).rejects.toMatchObject({ code: 'CORE_ASSET_SELECTION_UNSUPPORTED' });

    const first = await importSheet(round.id);
    const second = await importSheet(round.id);
    expect(first.assetFile.type).toBe('character_sheet');
    await projectData.setCastingCandidateStatus({ homeDir, assetFileId: second.assetFile.id, status: 'hidden' });
    const shown = await projectData.showCastingCostume({ homeDir, costumeId: armour.id });
    expect(shown.rounds.map((entry) => entry.number)).toEqual([2, 1]);
    expect(shown.rounds[1]!.candidates.map((candidate) => [candidate.assetFileId, candidate.status])).toEqual([
      [first.assetFile.id, 'candidate'],
      [second.assetFile.id, 'hidden'],
    ]);

    const context = await projectData.readMediaGenerationContext({
      homeDir, purpose: 'cast.character-sheet', target: { kind: 'castingRound', id: round.id },
    });
    expect(context.targetContext).toMatchObject({ kind: 'characterSheetRound', costume: { id: armour.id }, look: { id: older.id } });
    expect(context.outputGuidance.aspectRatio?.value).toBe('16:9');
    expect(context.suggestedReferences.find((group) => group.id === 'cast-identity')?.candidates).toEqual([
      expect.objectContaining({ assetFileId: cast, isWorkflowSelected: true }),
    ]);
    expect(context.suggestedReferences.find((group) => group.id === 'cast-continuity')?.candidates.map((candidate) => candidate.assetFileId))
      .toEqual([first.assetFile.id]);

    await expect(projectData.selectAssetFile({
      ...project, homeDir, target: { kind: 'castCostume', id: robe.id }, assetFileId: first.assetFile.id,
    })).rejects.toMatchObject({ code: 'CORE_ASSET_SELECTION_INVALID' });
    await projectData.selectAssetFile({ ...project, homeDir, target: { kind: 'castCostume', id: armour.id }, assetFileId: first.assetFile.id });

    await projectData.setCastingCandidateStatus({ homeDir, assetFileId: first.assetFile.id, status: 'hidden' });
    const nextRound = await createRound(costumeSubject(armour.id));
    const nextContext = await projectData.readMediaGenerationContext({
      homeDir, purpose: 'cast.character-sheet', target: { kind: 'castingRound', id: nextRound.id },
    });
    expect(nextContext.suggestedReferences.find((group) => group.id === 'cast-continuity')?.candidates).toEqual([
      expect.objectContaining({ assetFileId: first.assetFile.id, isDisplaySelected: true }),
    ]);

    const resource = await projectData.readCastCastingResource({ ...project, homeDir, castMemberId: MEHMED });
    expect(resource.costumes.map((costume) => [costume.name, costume.characterSheetAssetFileId, costume.rounds.length])).toEqual([
      ['Armour', first.assetFile.id, 3],
      ['Robe', null, 1],
    ]);

    const scene = await projectData.readMediaGenerationContext({
      homeDir, purpose: 'scene.storyboard-sheet', target: { kind: 'scene', id: sceneIds[0]! },
    });
    if (scene.targetContext.kind !== 'scene') {
      throw new Error('Expected Scene context.');
    }
    const mehmed = scene.targetContext.castMembers.find((member) => member.castMember.id === MEHMED);
    expect(mehmed?.wardrobe).toMatchObject({ look: { id: older.id, name: 'Older' }, costume: { name: 'Armour' }, characterSheetAssetFileId: first.assetFile.id });
    const continuity = scene.suggestedReferences.find((group) => group.id === 'cast-continuity' && group.subject?.id === MEHMED);
    expect(continuity?.candidates[0]).toMatchObject({ assetFileId: first.assetFile.id, isWorkflowSelected: true });
  });

  it('keeps a costume with sheet rounds in its Look and releases its sheets when it is removed', async () => {
    const { young, older } = await writeTwoLooks();
    const { armour, robe } = await writeArmour(older.id);
    await castLook(older.id);
    const round = await createRound(costumeSubject(armour.id));
    const sheet = await importSheet(round.id);
    await projectData.selectAssetFile({ ...project, homeDir, target: { kind: 'castCostume', id: armour.id }, assetFileId: sheet.assetFile.id });

    await expect(projectData.writeCastWardrobePlan({
      homeDir,
      document: {
        kind: 'castWardrobePlan',
        castMemberId: MEHMED,
        costumes: [{ id: armour.id, name: 'Armour', lookId: young.id, wardrobe: ['Plate'], continuityNotes: [], sceneIds: [] }],
      },
    })).rejects.toMatchObject({ issues: [expect.objectContaining({ code: 'CASTING_COSTUME_LOOK_CHANGE_HAS_SHEETS' })] });

    const removed = await projectData.writeCastWardrobePlan({
      homeDir,
      document: {
        kind: 'castWardrobePlan',
        castMemberId: MEHMED,
        costumes: [{ id: robe.id, name: 'Robe', lookId: young.id, wardrobe: ['Dark robe'], continuityNotes: [], sceneIds: [] }],
      },
    });
    expect(removed).toMatchObject({ clearedSheetSelections: [armour.id], releasedSheetAssetFileIds: [sheet.assetFile.id] });
    await expect(projectData.showCastingCostume({ homeDir, costumeId: armour.id })).rejects.toMatchObject({ code: 'CASTING_COSTUME_NOT_FOUND' });
    const assets = await projectData.readCastCastingResource({ ...project, homeDir, castMemberId: MEHMED });
    expect(assets.costumes.map((costume) => costume.rounds)).toEqual([[]]);
  });

  it('saves casting defaults in Project Settings', async () => {
    const routes = [{ provider: 'fal-ai', model: { key: 'model-a', name: 'Model A' }, count: 4 }];
    expect((await projectData.showCastingSettings({ homeDir })).casting).toEqual({ candidateRoutes: [], characterSheetRoutes: [], candidateDetail: 'lowest', characterSheetDetail: 'highest' });
    const casting = { candidateRoutes: routes, characterSheetRoutes: [{ ...routes[0], count: 2 }], candidateDetail: 'mid', characterSheetDetail: 'highest' };
    const report = await projectData.setCastingSettings({ ...project, homeDir, casting });
    expect(report.casting).toEqual(casting);
    expect((await projectData.showCastingSettings({ homeDir })).casting).toEqual(casting);
    await expect(projectData.setCastingSettings({ ...project, homeDir, casting: { ...casting, characterSheetRoutes: [{ ...routes[0], count: 0 }] } }))
      .rejects.toMatchObject({ code: 'CASTING_DOCUMENT_INVALID' });
    await expect(projectData.setCastingSettings({ ...project, homeDir, casting: { ...casting, candidateDetail: '4K' } }))
      .rejects.toMatchObject({ code: 'CASTING_DOCUMENT_INVALID' });
  });
});
