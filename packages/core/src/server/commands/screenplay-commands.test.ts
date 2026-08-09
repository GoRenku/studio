import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type {
  Screenplay,
  ScreenplayInput,
} from '../../client/screenplay/index.js';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
} from '../index.js';
import { deleteSectionAndSpliceChildren } from '../screenplay/commands/sections.js';
import { assertValidScreenplay } from '../screenplay/validation/blocks.js';
import { validateScreenplayStructure } from '../screenplay/validation/structure.js';
import {
  createBlankMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';

const SUBJECTS = {
  castMemberIds: new Set(['cast_urban', 'cast_mara']),
  locationIds: new Set(['location_forge']),
  propIds: new Set(['prop_drawing']),
};

describe('scene-first Screenplay', () => {
  let homeDir: string;
  let projectData = createProjectDataService();

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-screenplay-command-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    projectData = createProjectDataService();
  });

  it('validates and round-trips every block, dialogue, reference, and organization branch', () => {
    const screenplay = completeScreenplay();
    expect(() => assertValidScreenplay(screenplay, {
      subjects: SUBJECTS,
      context: 'complete Screenplay test',
    })).not.toThrow();
    expect(screenplay.scenes[0]?.blocks.map((block) => block.type)).toEqual([
      'action', 'transition', 'shot', 'lyrics', 'castList', 'note',
      'specialHeading', 'titleCard', 'super', 'dialogue', 'dualDialogue',
    ]);
  });

  it('rejects unknown block fields, duplicate identities, invalid structure, and overlapping ranges', () => {
    const unknownField = structuredClone(completeScreenplay()) as Screenplay & {
      scenes: Array<Screenplay['scenes'][number] & { unexpected?: boolean }>;
    };
    unknownField.scenes[0]!.unexpected = true;
    expect(() => assertValidScreenplay(unknownField, {
      subjects: SUBJECTS,
      context: 'unknown field',
    })).toThrowError(expect.objectContaining({ code: 'SCREENPLAY_INVALID_CONTENT' }));

    const duplicate = structuredClone(completeScreenplay());
    duplicate.scenes[0]!.blocks[1]!.id = duplicate.scenes[0]!.blocks[0]!.id;
    expect(() => assertValidScreenplay(duplicate, {
      subjects: SUBJECTS,
      context: 'duplicate ID',
    })).toThrowError(expect.objectContaining({ code: 'SCREENPLAY_INVALID_CONTENT' }));

    const missingPlacement = structuredClone(completeScreenplay());
    missingPlacement.structure = missingPlacement.structure.filter(
      (entry) => entry.content.type !== 'scene',
    );
    expect(validateScreenplayStructure(missingPlacement).traversal).toBeNull();

    const overlap = structuredClone(completeScreenplay());
    overlap.references.push({
      id: 'reference_overlap',
      subject: { type: 'prop', id: 'prop_drawing' },
      target: { type: 'block', sceneId: 'scene_forge', blockId: 'block_action' },
      role: 'mention',
      range: { start: 20, length: 5 },
    });
    expect(() => assertValidScreenplay(overlap, {
      subjects: SUBJECTS,
      context: 'overlap',
    })).toThrowError(expect.objectContaining({ code: 'SCREENPLAY_INVALID_CONTENT' }));
  });

  it('accepts opaque, empty, and duplicate supplied Scene numbers unchanged', () => {
    const screenplay = completeScreenplay();
    screenplay.scenes.push({
      id: 'scene_second',
      productionNumber: screenplay.scenes[0]!.productionNumber,
      heading: 'EXT. SECOND - DAY',
      blocks: [],
    });
    screenplay.structure.push({
      id: 'entry_scene_second',
      parentSectionId: 'section_sequence',
      content: { type: 'scene', sceneId: 'scene_second' },
      position: 1,
    });
    screenplay.scenes[0]!.productionNumber = '';

    expect(() => assertValidScreenplay(screenplay, {
      subjects: SUBJECTS,
      context: 'opaque Scene numbers',
    })).not.toThrow();
    expect(screenplay.scenes.map((scene) => scene.productionNumber)).toEqual(['', 'A12']);
  });

  it('rejects invalid reference subjects, targets, roles, ranges, and duplicate speakers', () => {
    const invalidScreenplays = [
      mutateReference('reference_presence', (reference) => {
        reference.subject = { type: 'castMember', id: 'cast_missing' };
      }),
      mutateReference('reference_prop', (reference) => {
        reference.target = {
          type: 'block',
          sceneId: 'scene_forge',
          blockId: 'block_missing',
        };
      }),
      mutateReference('reference_prop', (reference) => {
        reference.role = 'speaker';
      }),
      mutateReference('reference_prop', (reference) => {
        delete reference.range;
      }),
      mutateReference('reference_prop', (reference) => {
        reference.range = { start: 1000, length: 1 };
      }),
      (() => {
        const screenplay = completeScreenplay();
        const speaker = screenplay.references.find(
          (reference) => reference.id === 'reference_speaker_0',
        )!;
        screenplay.references.push({ ...structuredClone(speaker), id: 'reference_duplicate_speaker' });
        return screenplay;
      })(),
    ];

    for (const screenplay of invalidScreenplays) {
      expect(() => assertValidScreenplay(screenplay, {
        subjects: SUBJECTS,
        context: 'invalid reference matrix',
      })).toThrowError(expect.objectContaining({ code: 'SCREENPLAY_INVALID_CONTENT' }));
    }
  });

  it('promotes direct children in place when a Section is deleted', () => {
    const screenplay = completeScreenplay();
    const before = canonicalSceneIds(screenplay);

    deleteSectionAndSpliceChildren(screenplay, 'section_act');

    expect(screenplay.sections.map((section) => section.id)).toEqual([
      'section_sequence',
    ]);
    expect(canonicalSceneIds(screenplay)).toEqual(before);
    expect(screenplay.structure.find((entry) =>
      entry.content.type === 'section'
      && entry.content.sectionId === 'section_sequence'
    )?.parentSectionId).toBeUndefined();
  });

  it('creates an aggregate, resolves request-local keys, applies focused operations, and restores revisions', async () => {
    const created = await createBlankMovieProject({ homeDir, projectData });
    if (!created) {
      return;
    }

    const createReport = await projectData.createScreenplay({
      projectName: created.projectName,
      homeDir,
      screenplay: minimalScreenplayInput(),
      idGenerator: createDeterministicIdGenerator(),
    });
    expect(createReport.generatedIdentities.map((identity) => identity.kind)).toEqual([
      'block', 'scene', 'block', 'section', 'structureEntry', 'structureEntry',
    ]);

    const createdScreenplay = await projectData.readScreenplayStructure({
      projectName: created.projectName,
      homeDir,
    });
    expect(createdScreenplay.orderedSceneIds).toHaveLength(1);
    expect(createdScreenplay.screenplay.opening[0]?.text).toBe('FADE IN:');
    const sceneId = createdScreenplay.orderedSceneIds[0]!;

    await expect(projectData.applyScreenplayOperations({
      projectName: created.projectName,
      homeDir,
      operations: [{
        operation: 'scene.update',
        scene: {
          id: sceneId,
          heading: 'INT. WORKSHOP - NIGHT',
          blocks: [{
            id: 'screenplay_block_unknown',
            type: 'action',
            text: 'This caller-provided durable ID was never created.',
          }],
        },
      }],
    })).rejects.toMatchObject({ code: 'SCREENPLAY_INVALID_CONTENT' });

    const applyReport = await projectData.applyScreenplayOperations({
      projectName: created.projectName,
      homeDir,
      operations: [
        {
          operation: 'opening.replace',
          opening: [{ key: 'opening-title', type: 'titleCard', text: 'BASILICA' }],
        },
        {
          operation: 'scene.update',
          scene: {
            id: sceneId,
            heading: 'EXT. TEST FIELD - DAWN',
            blocks: [
              {
                key: 'new-action',
                type: 'action',
                text: 'The cannon waits.',
              },
            ],
          },
        },
      ],
      idGenerator: createDeterministicIdGenerator(),
    });
    expect(applyReport.generatedIdentities.map((identity) => identity.key)).toEqual([
      'opening-title', 'new-action',
    ]);

    const revised = await projectData.readScreenplayStructure({
      projectName: created.projectName,
      homeDir,
    });
    expect(revised.screenplay.opening[0]).toMatchObject({ type: 'titleCard', text: 'BASILICA' });
    expect(revised.screenplay.scenes[0]).toMatchObject({
      id: sceneId,
      productionNumber: '1',
      heading: 'EXT. TEST FIELD - DAWN',
    });

    const revisions = await projectData.listScreenplayRevisions({
      projectName: created.projectName,
      homeDir,
    });
    expect(revisions.revisions).toHaveLength(2);
    await projectData.restoreScreenplayRevision({
      projectName: created.projectName,
      revisionId: createReport.screenplayRevisionId,
      homeDir,
    });
    const restored = await projectData.readScreenplayStructure({
      projectName: created.projectName,
      homeDir,
    });
    expect(restored.screenplay.opening[0]?.text).toBe('FADE IN:');
    expect(restored.screenplay.scenes[0]?.productionNumber).toBe('1');
  });

  it('moves Scenes and Sections without changing identity and rolls back an invalid final structure', async () => {
    const created = await createBlankMovieProject({ homeDir, projectData });
    if (!created) {
      return;
    }
    await projectData.createScreenplay({
      projectName: created.projectName,
      homeDir,
      screenplay: minimalScreenplayInput(),
      idGenerator: createDeterministicIdGenerator(),
    });
    const initial = await projectData.readScreenplayStructure({
      projectName: created.projectName,
      homeDir,
    });
    const firstSceneId = initial.orderedSceneIds[0]!;
    const actId = initial.screenplay.sections[0]!.id;

    const moveReport = await projectData.applyScreenplayOperations({
      projectName: created.projectName,
      homeDir,
      idGenerator: createDeterministicIdGenerator(),
      operations: [
        {
          operation: 'section.add',
          section: { key: 'sequence-two', type: 'sequence', title: 'Sequence II' },
          structureEntryKey: 'sequence-two-entry',
          placement: { parentSection: { id: actId }, at: 'end' },
        },
        {
          operation: 'section.move',
          section: { key: 'sequence-two' },
          placement: { at: 'start' },
        },
        {
          operation: 'scene.add',
          scene: {
            key: 'scene-two',
            heading: 'EXT. WORKSHOP - DAWN',
            blocks: [{ key: 'scene-two-action', type: 'action', text: 'The doors open.' }],
          },
          structureEntryKey: 'scene-two-entry',
          placement: { at: 'end' },
        },
        {
          operation: 'scene.move',
          scene: { id: firstSceneId },
          placement: { afterEntry: { key: 'scene-two-entry' } },
        },
      ],
    });
    const secondSceneId = moveReport.generatedIdentities.find(
      (identity) => identity.key === 'scene-two',
    )!.id;
    const sequenceId = moveReport.generatedIdentities.find(
      (identity) => identity.key === 'sequence-two',
    )!.id;
    const moved = await projectData.readScreenplayStructure({
      projectName: created.projectName,
      homeDir,
    });
    expect(moved.orderedSceneIds).toEqual([
      secondSceneId,
      firstSceneId,
    ]);
    expect(moved.screenplay.scenes.map((scene) => scene.productionNumber)).toEqual([
      '1A', '1',
    ]);
    expect(moved.orderedSceneIds.map((sceneId) =>
      moved.screenplay.scenes.find((scene) => scene.id === sceneId)!.productionNumber
    )).toEqual(['1A', '1']);
    expect(moved.screenplay.sections).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: actId }),
      expect.objectContaining({ id: sequenceId }),
    ]));
    const revisionsBeforeFailure = await projectData.listScreenplayRevisions({
      projectName: created.projectName,
      homeDir,
    });

    await expect(projectData.applyScreenplayOperations({
      projectName: created.projectName,
      homeDir,
      operations: [{
        operation: 'section.move',
        section: { id: actId },
        placement: { parentSection: { id: sequenceId }, at: 'end' },
      }],
    })).rejects.toMatchObject({ code: 'SCREENPLAY_STRUCTURE_INVALID' });

    const afterFailure = await projectData.readScreenplayStructure({
      projectName: created.projectName,
      homeDir,
    });
    const revisionsAfterFailure = await projectData.listScreenplayRevisions({
      projectName: created.projectName,
      homeDir,
    });
    expect(afterFailure).toEqual(moved);
    expect(revisionsAfterFailure).toEqual(revisionsBeforeFailure);

    await projectData.applyScreenplayOperations({
      projectName: created.projectName,
      homeDir,
      operations: [{ operation: 'scene.delete', scene: { id: secondSceneId } }],
    });
    const inserted = await projectData.applyScreenplayOperations({
      projectName: created.projectName,
      homeDir,
      idGenerator: createDeterministicIdGenerator(),
      operations: [{
        operation: 'scene.add',
        scene: { key: 'inserted-scene', heading: 'INT. INSERTED ROOM - DAY', blocks: [] },
        structureEntryKey: 'inserted-scene-entry',
        placement: { at: 'start' },
      }],
    });
    const insertedSceneId = inserted.generatedIdentities.find(
      (identity) => identity.key === 'inserted-scene'
    )!.id;
    const afterInsertion = await projectData.readScreenplayStructure({
      projectName: created.projectName,
      homeDir,
    });
    expect(afterInsertion.orderedSceneIds.map((sceneId) =>
      afterInsertion.screenplay.scenes.find((scene) => scene.id === sceneId)!.productionNumber
    )).toEqual(['1B', '1']);

    await projectData.restoreScreenplayRevision({
      projectName: created.projectName,
      homeDir,
      revisionId: moveReport.screenplayRevisionId,
    });
    const restored = await projectData.readScreenplayStructure({
      projectName: created.projectName,
      homeDir,
    });
    expect(restored.orderedSceneIds).toEqual([secondSceneId, firstSceneId]);
    expect(restored.orderedSceneIds.map((sceneId) =>
      restored.screenplay.scenes.find((scene) => scene.id === sceneId)!.productionNumber
    )).toEqual(['1A', '1']);
    expect(restored.screenplay.scenes.some((scene) => scene.id === insertedSceneId)).toBe(false);
  });
});

function mutateReference(
  referenceId: string,
  mutation: (reference: Screenplay['references'][number]) => void,
): Screenplay {
  const screenplay = completeScreenplay();
  mutation(screenplay.references.find((reference) => reference.id === referenceId)!);
  return screenplay;
}

function minimalScreenplayInput(): ScreenplayInput {
  return {
    opening: [{ key: 'opening-fade', type: 'transition', text: 'FADE IN:' }],
    scenes: [{
      key: 'scene-one',
      heading: 'INT. WORKSHOP - NIGHT',
      blocks: [{ key: 'scene-action', type: 'action', text: 'A hammer falls.' }],
    }],
    sections: [{ key: 'act-one', type: 'act', title: 'Act I' }],
    structure: [
      {
        key: 'act-entry',
        content: { type: 'section', section: { key: 'act-one' } },
        position: 0,
      },
      {
        key: 'scene-entry',
        parentSection: { key: 'act-one' },
        content: { type: 'scene', scene: { key: 'scene-one' } },
        position: 0,
      },
    ],
    references: [],
  };
}

function completeScreenplay(): Screenplay {
  return {
    opening: [{ id: 'opening_fade', type: 'transition', text: 'FADE IN:' }],
    scenes: [{
      id: 'scene_forge',
      productionNumber: 'A12',
      heading: 'INT. IMPERIAL FOUNDRY - NIGHT',
      title: 'The Pour',
      blocks: [
        { id: 'block_action', type: 'action', text: 'Urban studies the drawing.' },
        { id: 'block_transition', type: 'transition', text: 'CUT TO:' },
        { id: 'block_shot', type: 'shot', text: 'CLOSE ON THE MOLD.' },
        { id: 'block_lyrics', type: 'lyrics', text: 'Hammer, bell, and flame.' },
        { id: 'block_cast_list', type: 'castList', text: 'URBAN, MARA' },
        { id: 'block_note', type: 'note', text: 'The metal remains audible.' },
        { id: 'block_special', type: 'specialHeading', text: 'LATER' },
        { id: 'block_title', type: 'titleCard', text: '1453' },
        { id: 'block_super', type: 'super', text: 'EDIRNE' },
        {
          id: 'turn_urban',
          type: 'dialogue',
          characterName: 'URBAN',
          extensions: ['O.S.'],
          parts: [
            { id: 'part_urban_direction', type: 'parenthetical', text: 'quietly' },
            { id: 'part_urban_speech', type: 'speech', text: 'Hold the line.' },
          ],
        },
        {
          id: 'block_dual',
          type: 'dualDialogue',
          left: {
            id: 'turn_left',
            characterName: 'URBAN',
            extensions: [],
            parts: [{ id: 'part_left', type: 'speech', text: 'Now.' }],
          },
          right: {
            id: 'turn_right',
            characterName: 'MARA',
            extensions: ['V.O.'],
            parts: [{ id: 'part_right', type: 'speech', text: 'Wait.' }],
          },
        },
      ],
    }],
    sections: [
      { id: 'section_act', type: 'act', title: 'Act I' },
      { id: 'section_sequence', type: 'sequence', title: 'The Foundry' },
    ],
    structure: [
      {
        id: 'entry_act',
        content: { type: 'section', sectionId: 'section_act' },
        position: 0,
      },
      {
        id: 'entry_sequence',
        parentSectionId: 'section_act',
        content: { type: 'section', sectionId: 'section_sequence' },
        position: 0,
      },
      {
        id: 'entry_scene',
        parentSectionId: 'section_sequence',
        content: { type: 'scene', sceneId: 'scene_forge' },
        position: 0,
      },
    ],
    references: [
      {
        id: 'reference_opening',
        subject: { type: 'location', id: 'location_forge' },
        target: { type: 'openingElement', elementId: 'opening_fade' },
        role: 'mention',
        range: { start: 0, length: 4 },
      },
      {
        id: 'reference_setting',
        subject: { type: 'location', id: 'location_forge' },
        target: { type: 'scene', sceneId: 'scene_forge' },
        role: 'setting',
      },
      {
        id: 'reference_heading',
        subject: { type: 'location', id: 'location_forge' },
        target: { type: 'sceneHeading', sceneId: 'scene_forge' },
        role: 'mention',
        range: { start: 5, length: 17 },
      },
      {
        id: 'reference_presence',
        subject: { type: 'castMember', id: 'cast_urban' },
        target: { type: 'scene', sceneId: 'scene_forge' },
        role: 'presence',
      },
      {
        id: 'reference_block_presence',
        subject: { type: 'prop', id: 'prop_drawing' },
        target: { type: 'block', sceneId: 'scene_forge', blockId: 'block_transition' },
        role: 'presence',
      },
      {
        id: 'reference_prop',
        subject: { type: 'prop', id: 'prop_drawing' },
        target: { type: 'block', sceneId: 'scene_forge', blockId: 'block_action' },
        role: 'mention',
        range: { start: 18, length: 7 },
      },
      {
        id: 'reference_dialogue_part',
        subject: { type: 'prop', id: 'prop_drawing' },
        target: {
          type: 'dialoguePart',
          sceneId: 'scene_forge',
          turnId: 'turn_urban',
          partId: 'part_urban_speech',
        },
        role: 'mention',
        range: { start: 0, length: 4 },
      },
      ...['turn_urban', 'turn_left', 'turn_right'].map((turnId, index) => ({
        id: `reference_speaker_${index}`,
        subject: { type: 'castMember' as const, id: index === 2 ? 'cast_mara' : 'cast_urban' },
        target: { type: 'dialogueCue' as const, sceneId: 'scene_forge', turnId },
        role: 'speaker' as const,
      })),
    ],
  };
}

function canonicalSceneIds(screenplay: Screenplay): string[] {
  const entriesByParent = new Map<string | undefined, typeof screenplay.structure>();
  for (const entry of screenplay.structure) {
    const siblings = entriesByParent.get(entry.parentSectionId) ?? [];
    siblings.push(entry);
    entriesByParent.set(entry.parentSectionId, siblings);
  }
  for (const siblings of entriesByParent.values()) {
    siblings.sort((left, right) => left.position - right.position);
  }
  const sceneIds: string[] = [];
  const visit = (parentSectionId?: string) => {
    for (const entry of entriesByParent.get(parentSectionId) ?? []) {
      if (entry.content.type === 'scene') {
        sceneIds.push(entry.content.sceneId);
      } else {
        visit(entry.content.sectionId);
      }
    }
  };
  visit();
  return sceneIds;
}
