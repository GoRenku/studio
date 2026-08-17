import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { PropDesignDocument } from '../../client/department-design.js';
import type { SceneBeatsInput } from '../../client/scene-beats/index.js';
import { createProjectDataService } from '../index.js';
import { openProjectStore } from '../database/lifecycle/store.js';
import { assetFiles, assetMemberships, assets } from '../schema/index.js';
import { createSampleMovieProject, writeConfig } from '../testing/project-data-fixtures.js';

describe('Generation purpose context', () => {
  let homeDir: string;
  const projectData = createProjectDataService();

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-scene-generation-context-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
  });

  it('projects opaque narrative text and every exact owned continuity file', async () => {
    const created = await createSampleMovieProject({ homeDir, projectData });
    if (!created) {
      return;
    }
    const screenplay = await projectData.readScreenplayStructure({ projectName: 'constantinople', homeDir });
    const scene = screenplay.screenplay.scenes[0]!;
    const cast = await projectData.listCastMembers({ homeDir });
    const locations = await projectData.listLocations({ homeDir });
    const castMemberId = cast[1]!.id;
    const locationId = locations[0]!.id;
    seedContinuityAssets(created.projectPath, { castMemberId, locationId });

    const context = await projectData.buildGenerationContext({
      projectName: 'constantinople',
      homeDir,
      purpose: 'scene.storyboard-sheet',
      target: { kind: 'scene', id: scene.id! },
    });

    expect(context.facts.contextText).toBe(
      "INT. MEHMED'S COUNCIL CHAMBER - NIGHT\n\nMehmed studies the city map."
    );
    expect(context.facts.sceneCastMemberIds).toEqual([castMemberId]);
    expect(context.facts.sceneLocationIds).toEqual([locationId]);
    expect(context.workflowPolicy).toMatchObject({
      preferredExecutionPath: 'codex-built-in',
      codexBuiltIn: {
        applicable: true,
        executionKind: 'agent-external',
        capability: 'codex.gpt-image-2',
      },
    });
    const castSlot = context.referenceGuide.sections.find((section) => section.id === 'cast')!.slots[0]!;
    expect(castSlot.label).toBe(cast[1]!.name);
    expect(castSlot.mediaKind).toBe('image');
    expect(castSlot.eligibleCandidates.map((candidate) => candidate.reference)).toEqual(expect.arrayContaining([
      { kind: 'asset-file', assetId: 'asset_cast_selected', assetFileId: 'asset_file_cast_selected' },
      { kind: 'asset-file', assetId: 'asset_cast_take', assetFileId: 'asset_file_cast_take' },
    ]));
    expect(castSlot.eligibleCandidates.some((candidate) =>
      candidate.reference.kind === 'asset-file' &&
      candidate.reference.assetId === 'asset_generic_reference'
    )).toBe(false);
    const locationSlot = context.referenceGuide.sections.find((section) => section.id === 'location')!.slots[0]!;
    expect(locationSlot.label).toBe(
      locations[0]!.name
    );
    expect(locationSlot.mediaKind).toBe('image');
    expect(locationSlot.eligibleCandidates.map((candidate) => candidate.reference)).toEqual([
      { kind: 'asset-file', assetId: 'asset_location_selected', assetFileId: 'asset_file_location_selected' },
    ]);

  });

  it('projects ordered Scene and Beat Props into exact Storyboard slots and Shot facts', async () => {
    const created = await createSampleMovieProject({ homeDir, projectData });
    if (!created) {
      return;
    }
    const screenplay = await projectData.readScreenplayStructure({ projectName: 'constantinople', homeDir });
    const scene = screenplay.screenplay.scenes[0]!;
    const castMemberId = screenplay.screenplay.references.find(
      (reference) => reference.subject.type === 'castMember'
    )!.subject.id;
    const locationId = screenplay.screenplay.references.find(
      (reference) => reference.subject.type === 'location'
    )!.subject.id;
    const propIds = await createProps(['Map', 'Seal', 'Unrelated Banner']);
    await projectData.applyScreenplayOperations({
      projectName: 'constantinople',
      homeDir,
      operations: [{
        operation: 'reference.add',
        reference: {
          key: 'scene-map',
          subject: { type: 'prop', id: propIds[0]! },
          target: { type: 'scene', scene: { id: scene.id! } },
          role: 'presence',
        },
      }],
    });
    const beats: SceneBeatsInput = {
      sceneId: scene.id!,
      beats: [
        beat('Map decision', scene.blocks[0]!.id, castMemberId, locationId, [propIds[1]!, propIds[0]!]),
        beat('Seal consequence', scene.blocks[0]!.id, castMemberId, locationId, [propIds[1]!]),
      ],
    };
    await projectData.createSceneBeatsRevision({ homeDir, document: beats });
    seedPropContinuityAssets(created.projectPath, {
      selectedPropId: propIds[0]!,
      unrelatedPropId: propIds[2]!,
    });

    const context = await projectData.buildGenerationContext({
      projectName: 'constantinople',
      homeDir,
      purpose: 'scene.storyboard-sheet',
      target: { kind: 'scene', id: scene.id! },
    });

    expect(context.facts.scenePropIds).toEqual([propIds[0], propIds[1]]);
    expect(context.facts).toMatchObject({
      projectAspectRatio: '16:9',
      sceneCastMemberIds: [castMemberId],
      sceneLocationIds: [locationId],
      sceneDialogueIds: [],
    });
    expect(context.referenceGuide.sections.map((section) => section.id)).toEqual([
      'visual-language',
      'cast',
      'location',
      'prop',
    ]);
    const propSlots = context.referenceGuide.sections.find((section) => section.id === 'prop')!.slots;
    expect(propSlots.map((slot) => slot.subject)).toEqual([
      { kind: 'prop', id: propIds[0] },
      { kind: 'prop', id: propIds[1] },
    ]);
    expect(propSlots[0]!.eligibleCandidates.map((candidate) => candidate.reference)).toEqual([
      { kind: 'asset-file', assetId: 'asset_prop_selected', assetFileId: 'asset_file_prop_selected' },
    ]);
    expect(propSlots[1]!.eligibleCandidates).toEqual([]);
    expect(propSlots.flatMap((slot) => slot.eligibleCandidates).some((candidate) =>
      candidate.reference.kind === 'asset-file' &&
      candidate.reference.assetId === 'asset_prop_unrelated'
    )).toBe(false);

    const plan = await projectData.createShotPlan({
      projectName: 'constantinople',
      homeDir,
      sceneId: scene.id!,
      title: 'Prop inheritance',
      coverage: null,
      shots: [],
    });
    const authored = await projectData.addShotToPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: plan.shotPlan.id,
      shot: {
        title: 'Map detail',
        description: 'The seal lands on the map.',
        brief: {},
      },
    });
    const shotContext = await projectData.buildGenerationContext({
      projectName: 'constantinople',
      homeDir,
      purpose: 'shot.image',
      target: { kind: 'shot', id: authored.shotPlan.shots[0]!.id },
    });
    expect(shotContext.facts.scenePropIds).toEqual([propIds[0], propIds[1]]);
  });

  it('warns when optional Shot Plan video reference candidates are unavailable', async () => {
    const created = await createSampleMovieProject({ homeDir, projectData });
    if (!created) {
      return;
    }
    const screenplay = await projectData.readScreenplayStructure({ projectName: 'constantinople', homeDir });
    const scene = screenplay.screenplay.scenes[0]!;
    const shotPlan = await projectData.createShotPlan({
      projectName: 'constantinople',
      homeDir,
      sceneId: scene.id!,
      title: 'Video authoring source',
      coverage: null,
      shots: [],
    });

    const context = await projectData.buildGenerationContext({
      projectName: 'constantinople',
      homeDir,
      purpose: 'shot-plan.video-generation',
      target: { kind: 'project', id: 'constantinople' },
      authoredFrom: { kind: 'shotPlan', id: shotPlan.shotPlan.id },
    });

    expect(context.referenceGuide.notices).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'CORE_GENERATION_OPTIONAL_REFERENCE_UNAVAILABLE',
      }),
    ]));
    expect(context.workflowPolicy).toMatchObject({
      preferredExecutionPath: 'renku-managed',
      codexBuiltIn: { applicable: false },
    });
  });

  it('projects the exact active Prop Design into Prop generation contexts', async () => {
    const created = await createSampleMovieProject({ homeDir, projectData });
    if (!created) {
      return;
    }
    const propReport = await projectData.applyPropOperations({
      homeDir,
      document: {
        kind: 'propOperations',
        operations: [
          {
            operation: 'prop.add',
            prop: {
              key: 'field-cannon',
              handle: 'field-cannon',
              name: 'Field Cannon',
            },
          },
        ],
      },
    });
    const propId = propReport.generatedIds?.[0]?.id as string;
    const design: PropDesignDocument = {
      kind: 'propDesign',
      propId,
      title: 'Field Cannon Prop Design',
      design: {
        designThesis: 'A siege engine whose mass communicates strategic force.',
        formAndSilhouette: ['Long bronze barrel', 'low timber carriage'],
        materialsAndSurfaces: ['Cast bronze', 'weathered oak'],
        constructionAndFunction: ['Iron-banded wheels', 'wedged elevation'],
        scaleAndHandling: ['Crew-served', 'requires a hauling team'],
        statesAndVariants: ['Travel state', 'emplaced firing state'],
        continuity: ['The split right wheel spoke remains visible'],
        propSheetGuidance: ['Show side elevation and loading details'],
        generationGuidance: ['Historically grounded Ottoman siege cannon'],
      },
    };
    await projectData.writePropDesign({ homeDir, document: design });

    const contexts = await Promise.all([
      projectData.buildGenerationContext({
        projectName: 'constantinople',
        homeDir,
        purpose: 'prop.sheet',
        target: { kind: 'prop', id: propId },
      }),
      projectData.buildGenerationContext({
        projectName: 'constantinople',
        homeDir,
        purpose: 'prop.hero',
        target: { kind: 'prop', id: propId },
      }),
    ]);

    expect(contexts.map((context) => context.facts.activePropDesign)).toEqual([
      design,
      design,
    ]);
  });

  async function createProps(names: string[]): Promise<string[]> {
    const report = await projectData.applyPropOperations({
      homeDir,
      document: {
        kind: 'propOperations',
        operations: names.map((name) => ({
          operation: 'prop.add' as const,
          prop: {
            key: name.toLowerCase().replaceAll(' ', '-'),
            handle: name.toLowerCase().replaceAll(' ', '-'),
            name,
          },
        })),
      },
    });
    return report.generatedIds?.map((identity) => identity.id) ?? [];
  }
});

function beat(
  title: string,
  screenplayBlockId: string,
  castMemberId: string,
  locationId: string,
  propIds: string[]
): SceneBeatsInput['beats'][number] {
  return {
    title,
    description: `${title} is visible in the council chamber.`,
    narrativeDevelopment: `${title} advances the decision.`,
    narrativePurpose: `${title} clarifies the Scene's progression.`,
    screenplayBlockIds: [screenplayBlockId],
    castMemberIds: [castMemberId],
    locationIds: [locationId],
    propIds,
  };
}

function seedContinuityAssets(
  projectFolder: string,
  ids: { castMemberId: string; locationId: string }
): void {
  const session = openProjectStore({ projectFolder, create: false });
  const now = '2026-07-14T10:00:00.000Z';
  try {
    session.db.insert(assets).values([
      asset('asset_cast_selected', 'character_sheet', 'Selected Cast Sheet', now),
      asset('asset_cast_take', 'character_sheet', 'Cast Take', now),
      asset('asset_location_selected', 'location_sheet', 'Selected Location Sheet', now),
      asset('asset_generic_reference', 'reference', 'Generic Maria Reference', now),
    ]).run();
    session.db.insert(assetFiles).values([
      assetFile('asset_file_cast_selected', 'asset_cast_selected', 'cast-selected.png', now),
      assetFile('asset_file_cast_take', 'asset_cast_take', 'cast-take.png', now),
      assetFile('asset_file_location_selected', 'asset_location_selected', 'location-selected.png', now),
      assetFile('asset_file_generic_reference', 'asset_generic_reference', 'generic-reference.png', now),
    ]).run();
    session.db.insert(assetMemberships).values([
      membership('asset_cast_selected', `castMember:${ids.castMemberId}`, now),
      membership('asset_cast_take', `castMember:${ids.castMemberId}`, now),
      membership('asset_location_selected', `location:${ids.locationId}`, now),
      membership('asset_generic_reference', 'project', now),
    ]).run();
  } finally {
    session.close();
  }
}

function seedPropContinuityAssets(
  projectFolder: string,
  ids: { selectedPropId: string; unrelatedPropId: string }
): void {
  const session = openProjectStore({ projectFolder, create: false });
  const now = '2026-08-16T10:00:00.000Z';
  try {
    session.db.insert(assets).values([
      asset('asset_prop_selected', 'prop_sheet', 'Selected Prop Sheet', now),
      asset('asset_prop_unrelated', 'prop_sheet', 'Unrelated Prop Sheet', now),
    ]).run();
    session.db.insert(assetFiles).values([
      assetFile('asset_file_prop_selected', 'asset_prop_selected', 'prop-selected.png', now),
      assetFile('asset_file_prop_unrelated', 'asset_prop_unrelated', 'prop-unrelated.png', now),
    ]).run();
    session.db.insert(assetMemberships).values([
      membership('asset_prop_selected', `prop:${ids.selectedPropId}`, now),
      membership('asset_prop_unrelated', `prop:${ids.unrelatedPropId}`, now),
    ]).run();
  } finally {
    session.close();
  }
}

function asset(id: string, type: string, title: string, now: string) {
  return { id, type, mediaKind: 'image', title, origin: 'generated', availability: 'ready', createdAt: now, updatedAt: now };
}

function assetFile(id: string, assetId: string, filename: string, now: string) {
  return { id, assetId, role: 'primary', projectRelativePath: `references/${filename}`, mediaKind: 'image', mimeType: 'image/png', createdAt: now, updatedAt: now };
}

function membership(assetId: string, ownerKey: string, now: string) {
  return { assetId, ownerKey, createdAt: now, updatedAt: now };
}
